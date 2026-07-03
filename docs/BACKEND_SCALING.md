# Backend API Scaling

## 목적과 범위

이 구성은 단일 Node 프로세스의 CPU 사용 한계를 줄이고, 4코어 서버에서 2~4개 API worker로 public read API 처리 여유를 늘리기 위한 운영안입니다. 목표는 `/v1/bootstrap`, `/v1/members`, `/v1/live-status`, `/v1/hub-events*`, `/v1/music*`, `/v1/songs*` 같은 read 요청에서 단일 worker 대비 2~3배의 처리 여유를 **측정하는 것**이며, 고정된 성능 향상을 보장하지 않습니다.

우선순위는 다음과 같습니다.

1. 기존 Host Nginx가 있으면 정적 Docker API worker + Host Nginx
2. 앱 전용 프록시까지 Compose로 관리하면 정적 Docker API worker + Docker Nginx
3. Docker를 사용하지 않는 VM에서는 PM2 cluster
4. 프로세스를 포트별로 완전히 분리해야 하면 systemd multi-instance + Host Nginx

## Production 필수 조건

- `NODE_ENV=production`
- `HUB_EVENTS_STORAGE_MODE=prisma`와 PostgreSQL
- multi-worker music sync를 활성화하면 `REDIS_URL` 필수
- credential과 token은 `.env`, Docker secret 또는 외부 secret manager에서 주입
- API worker 수만큼 Prisma connection pool도 늘어나므로 PostgreSQL 최대 연결 수 확인
- scheduler/worker loop는 종류별로 정확히 한 인스턴스만 실행
- API worker 안에 cron loop를 추가하지 않음

`REDIS_URL`이 없으면 music sync는 기존 프로세스 로컬 lock으로 동작하며 production 로그에 경고를 남깁니다. 이 fallback은 multi-worker에서 안전하지 않으므로 해당 상태에서는 music scheduler를 실행하지 마세요.

## Scale 대상이 아닌 기능

- `/v1/dev/*` mock route와 프로세스 로컬 preference/delivery-attempt fallback
- 프로세스 로컬 SSE queue인 `/v1/events/stream`
- CHZZK polling, Hub Event status reconcile, music discovery loop
- notification drain worker와 외부 API polling job

SSE는 Nginx에서 연결 업그레이드와 buffering 비활성화를 지원하지만, 현재 queue 자체는 worker 간 공유되지 않습니다. production scale 기능으로 간주하지 않습니다.

## 운영 모드 A: Docker 내부 Nginx

`docker-compose.scale.yml`은 기존 단일 `api`를 `single-api` profile로 제외하고 정적 `api-1`~`api-4`와 Nginx를 추가합니다. 실행 중인 API service는 공통 Docker network alias인 `stellive-api`를 사용하며, Nginx 1.27이 이 alias의 현재 주소 집합을 다시 resolve합니다. 따라서 동일한 설정으로 2개와 4개 구성을 모두 처리합니다. 외부에는 Nginx의 `4000`만 공개됩니다.

2 worker:

```bash
cd backend/stellive-hub-api
docker compose -f docker-compose.yml -f docker-compose.scale.yml up -d \
  postgres redis api-1 api-2 nginx \
  chzzk-live-worker hub-event-status-worker music-channel-discovery-worker
```

4 worker:

```bash
docker compose -f docker-compose.yml -f docker-compose.scale.yml up -d \
  postgres redis api-1 api-2 api-3 api-4 nginx \
  chzzk-live-worker hub-event-status-worker music-channel-discovery-worker
```

확인:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/health
docker compose -f docker-compose.yml -f docker-compose.scale.yml logs --tail=50 nginx
```

응답의 `hostname`과 `pid`로 실제 worker 분산을 확인할 수 있습니다. worker 수를 바꾼 뒤에는 Nginx DNS 갱신에 최대 10초가 걸릴 수 있습니다.

## 운영 모드 B: 기존 Host Nginx

Host Nginx가 이미 있으면 이 방식을 우선 사용합니다. `docker-compose.host-nginx.yml`은 Docker Nginx를 만들지 않고 API를 host loopback에만 publish합니다. `0.0.0.0:4001` 같은 공개 binding으로 변경하지 마세요.

2 worker:

```bash
cd backend/stellive-hub-api
docker compose -f docker-compose.yml -f docker-compose.host-nginx.yml up -d api-1 api-2
```

4 worker:

```bash
docker compose -f docker-compose.yml -f docker-compose.host-nginx.yml up -d api-1 api-2 api-3 api-4
```

singleton worker도 함께 운영할 때는 한 번만 실행합니다.

```bash
docker compose -f docker-compose.yml -f docker-compose.host-nginx.yml up -d \
  chzzk-live-worker hub-event-status-worker music-channel-discovery-worker
```

Host Nginx 예시입니다. 2 worker만 실행한다면 `4003`, `4004` server 줄은 제거합니다.

```nginx
map $http_upgrade $stellive_connection_upgrade {
    default upgrade;
    ''      '';
}

upstream stellive_hub_api {
    least_conn;
    server 127.0.0.1:4001 max_fails=3 fail_timeout=10s;
    server 127.0.0.1:4002 max_fails=3 fail_timeout=10s;
    server 127.0.0.1:4003 max_fails=3 fail_timeout=10s;
    server 127.0.0.1:4004 max_fails=3 fail_timeout=10s;
    keepalive 32;
}

server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://stellive_hub_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $stellive_connection_upgrade;
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

적용과 확인:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl http://127.0.0.1:4001/health
curl http://127.0.0.1:4002/health
curl http://localhost/health
```

Docker 내부 worker는 Host Nginx를 거치지 않고 `http://api-1:4000`을 호출합니다. `api-1` 장애 시 scheduler도 중단되므로 모니터링 후 `api-1`을 재시작해야 합니다. public read traffic의 나머지 API worker는 계속 서비스할 수 있습니다.

## Scheduler와 중복 실행 경계

Compose의 `chzzk-live-worker`, `hub-event-status-worker`, `music-channel-discovery-worker`는 scale하지 않습니다. 단일 scheduler가 한 번 호출하면 Docker DNS 또는 Nginx가 선택한 API worker 하나에서만 handler가 실행되며, 요청이 모든 API worker에 broadcast되지는 않습니다.

Music sync, official playlist sync, channel discovery는 Redis `SET NX PX` lock과 owner token 비교 삭제를 사용합니다. Notification drain은 기존 DB job claim/dedupe 경계를 유지합니다. CHZZK poll, Hub Event reconcile, YouTube renewal/backfill endpoint는 단일 scheduler caller 원칙이 여전히 필요합니다. 운영자나 외부 scheduler가 같은 endpoint를 동시에 두 번 호출하면 외부 API 요청 자체가 중복될 수 있으므로, 두 번째 scheduler 인스턴스를 만들지 말고 internal endpoint를 공개 인터넷에 노출하지 마세요.

`MUSIC_SYNC_LOCK_SECONDS`는 관측된 최장 sync 시간보다 길게 설정해야 합니다. lock TTL이 작업 도중 만료되면 다른 worker가 새 lock을 얻을 수 있으므로 sync run 시간과 lock contention 로그를 함께 모니터링합니다.

## PM2 cluster

PM2 cluster는 여러 프로세스가 같은 port를 공유합니다. production에서는 프로세스 로컬 dev/mock/SSE 상태를 사용하지 않습니다.

```bash
cd backend/stellive-hub-api
npm ci
npm run build
npm install -g pm2
WEB_CONCURRENCY=2 npm run start:pm2
pm2 logs stellive-hub-api
WEB_CONCURRENCY=4 npm run reload:pm2
pm2 stop stellive-hub-api
```

PM2 reload는 SIGINT를 보내고 `kill_timeout` 동안 graceful shutdown을 기다립니다. scheduler는 PM2 cluster 앱 내부에서 실행하지 말고 별도 singleton process/service로 유지합니다.

## systemd multi-instance + Nginx

예시 `/etc/systemd/system/stellive-hub-api@.service`:

```ini
[Unit]
Description=Stellive Hub API instance %i
After=network-online.target postgresql.service redis.service

[Service]
Type=simple
User=stellive
WorkingDirectory=/opt/StelLiveNoti/backend/stellive-hub-api
Environment=NODE_ENV=production
Environment=HUB_EVENTS_STORAGE_MODE=prisma
EnvironmentFile=/etc/stellive-hub-api.env
ExecStart=/bin/sh -lc 'PORT=$((4000 + %i)); export PORT; exec /usr/bin/node dist/backend/stellive-hub-api/src/index.js'
Restart=always
RestartSec=3
KillSignal=SIGTERM
TimeoutStopSec=15

[Install]
WantedBy=multi-user.target
```

`stellive-hub-api@1`은 4001, `@2`는 4002, `@3`은 4003, `@4`는 4004를 사용합니다. 위 Host Nginx upstream을 그대로 적용할 수 있습니다.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now stellive-hub-api@1 stellive-hub-api@2
sudo systemctl restart stellive-hub-api@1 stellive-hub-api@2
sudo nginx -t && sudo systemctl reload nginx
journalctl -u 'stellive-hub-api@*' -f
```

4 worker로 늘릴 때 `@3`, `@4`를 enable/start하고 Nginx upstream에도 추가합니다. CHZZK, Hub Event, music discovery, notification drain은 각각 별도 singleton systemd service로 실행합니다.

## 부하 테스트

동일한 데이터와 PostgreSQL 상태에서 단일, 2개, 4개 worker를 순서대로 비교합니다.

```bash
npx autocannon -c 50 -d 30 http://localhost:4000/health
npx autocannon -c 50 -d 30 http://localhost:4000/v1/members
npx autocannon -c 50 -d 30 http://localhost:4000/v1/live-status
npx autocannon -c 50 -d 30 http://localhost:4000/v1/hub-events
npx autocannon -c 50 -d 30 http://localhost:4000/v1/music
```

각 실행에서 RPS, p95 latency, error rate, API CPU/메모리, PostgreSQL active connection 수를 기록합니다. DB 또는 외부 API가 병목이면 worker 수에 비례해 성능이 늘지 않으므로 Prisma pool과 cache hit rate도 함께 확인합니다. 외부 플랫폼 API를 실제로 호출하는 scheduler endpoint는 부하 테스트하지 않습니다.
