# 굿즈/행사 굿즈 목록(Goods Items) 설계

상태: **구현 완료, 미커밋** (브랜치 `feat/hub-event-goods-items`, 2026-10-07). 결정 사항은 아래 "확정된 결정" 참고. 단위 테스트로 검증했으며 모바일 UI는 실제 화면 확인 전이다.

후속 확인 필요:

- iOS 홈의 "마감 임박" 행은 상세 API를 호출하지 않고 목록 데이터로 상세를 열기 때문에 굿즈 섹션이 보이지 않는다 (기존 동작).
- 어드민 붙여넣기 교체는 기존 항목(취소 항목 포함)을 모두 삭제하고 새로 만든다. 확인 대화상자에 안내된다.

## 목적

팝업 스토어, 생일 굿즈, 콜라보, 콘서트 MD 부스처럼 판매 상품이 있는 `HubEvent`에 굿즈 목록(상품명, 가격, 구매 제한, 판매 채널, 특전 등)을 붙여 모바일 상세 화면에서 보여준다.

## 현재 구조 (구현됨)

- `HubEvent`는 일정·링크를 자식 테이블로 가진다: `HubEventScheduleItem`, `HubEventExternalLink` (`backend/stellive-hub-api/prisma/schema.prisma`).
- 일정 항목은 개별 CRUD·복구·정렬 어드민 API가 있다 (`backend/stellive-hub-api/src/routes/adminHubEventRoutes.ts`의 `/v1/admin/hub-events/:id/schedule-items*`).
- 이미지는 URL과 `policyState`만 저장하고 바이너리는 금지한다 (`backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts`의 `canDisplayHubEventImage`).
- 모바일은 공개 `HubEvent` DTO만 소비한다 (`shared/schemas/domain.ts`의 `HubEvent`). 공개 API 전반은 `docs/ADMIN_HUB_EVENTS_MOBILE_DISPLAY_DESIGN.md`, `docs/HUB_EVENTS_READ_API_DESIGN.md` 참고.
- 행사 데이터는 운영자가 `stellive-event-brief` 스킬로 공식 공지 1건을 가져와 초안을 만들고 어드민 콘솔에 등록한다 (`.agents/skills/stellive-event-brief/SKILL.md`).

## 데이터 수집 경로

### 원칙

서버는 굿즈 데이터를 **자동 수집하지 않는다**. 굿즈 목록은 기존 행사 데이터와 같이 운영자가 공식 공지를 근거로 큐레이션하고, 서버는 검증·저장·공개 DTO 투영만 담당한다. 굿즈에 대한 공식 API는 없고, 무단 크롤링은 `docs/PROJECT_RULES.md`에서 금지한다.

```text
공식 공지 URL (운영자 지정, stellive.me 또는 x.com/StelLive_kr)
  → stellive-event-brief fetcher (공지 1건, 공개 경로, 로그인 없음)
  → goodsItems JSON 초안 + 확인 필요 목록
  → 운영자 검토·보정
  → 어드민 붙여넣기 가져오기 → 검증 → 일괄 교체 → 게시
```

### 허용 출처

| 출처 | 용도 | 자동 수집 |
|---|---|---|
| `stellive.me` 공지 | 굿즈 목록·가격·제한·특전의 근거 | fetcher로 공지 1건 단위만 |
| `x.com/StelLive_kr` 게시물 | 보조 근거 | fetcher로 게시물 1건 단위만 (best-effort) |
| 팬딩 공식 스토어 (`fanding.kr/@stellive/...`) | `purchaseUrl` 링크 대상 | **금지** (아래 참고) |

### 공식 스토어(팬딩) 약관·robots 검토

검토일: 2026-10-07. 법률 자문이 아니라 공개 문서를 읽은 운영 판단이다. 약관이 개정되면 다시 확인한다.

- 공식 굿즈 공지의 스토어 링크는 `link.fanding.com/...` 단축 링크이고, `fanding.kr/@stellive/section/<id>`로 리다이렉트된다. 즉 공식 스토어는 팬딩(Fanding) 플랫폼이다.
- `https://fanding.kr/robots.txt`
  - `User-agent: *`는 `/app-editor`, `/payment-return`, `/account-info`, `/authorize/*` 등 일부 경로만 막고 상품/섹션 페이지는 막지 않는다.
  - `GPTBot`, `ClaudeBot`, `CCBot`, `Google-Extended`, `Applebot-Extended`, `Bytespider`는 사이트 전체(`/`)를 금지한다.
  - robots 허용은 수집 허가가 아니므로 약관을 우선한다.
- [팬딩 서비스 이용약관](https://docs.channel.io/policy/ko/articles/a73d365b-서비스-이용-약관)
  - 제11조(회원의 의무와 책임): 사이트의 상품·사업자 정보·콘텐츠 데이터를 무단 복제·수집·전송·배포하는 행위를 금지하며, 크롤링·스크래핑 같은 자동화 수단을 명시한다.
  - 제5조(권리의 귀속): 서비스의 이미지·정보·디자인 등에 대한 권리는 회사에 있으며, 명시적 승인 없는 배포·상업적 이용을 금지한다.
  - 제13조: 크리에이터가 게시한 상품 정보의 권리와 책임은 크리에이터(스텔라이브)에게 있다.

결정:

1. 팬딩을 `stellive-event-brief` fetcher 허용 출처나 서버 수집기에 추가하지 않는다.
2. 팬딩은 `purchaseUrl`(및 굿즈 항목 `purchaseUrl`) 링크 대상으로만 쓴다. 리다이렉트 결과 URL에는 utm·AppsFlyer 추적 파라미터가 붙으므로, 공지에 실린 단축 링크를 그대로 저장한다.
3. 팬딩 CDN 이미지 URL을 굿즈 이미지로 쓰지 않는다. 굿즈 항목 이미지는 기본 `policyState: "none"`(플레이스홀더)으로 시작한다.
4. 팬딩 페이지를 정식 데이터 출처로 쓰려면 팬딩(support@fanding.kr) 또는 스텔라이브 측의 명시적 허가를 먼저 받는다. 공개 API 존재 여부는 확인하지 않았다.

### 이미지 전용 공지 대응

팝업 MD 공지는 본문에 공통 안내만 있고 상품명·가격은 이미지에만 있는 경우가 많다 (예: `stellive.me/news/13930`, 본문 텍스트에 상품 목록 없음, 이미지 10장). 스킬 규칙상 이미지를 다운로드·저장하지 않으므로:

- 운영자가 공지 이미지를 보고 사실 정보(상품명, 가격, 구매 제한, 특전)만 붙여넣기 형식으로 입력한다.
- 입력 부담이 큰 행사는 굿즈 목록 없이 `purchaseUrl`만 제공한다.
- 홍보 문구·상세 설명은 옮겨 적지 않는다.

### 품절·재입고

품절·재고 상태는 관리하지 않는다. 굿즈 목록은 공지 기준의 정적 목록이며, 구성이 바뀌는 공지(추가 MD, 판매 취소 등)가 올라올 때만 운영자가 목록을 갱신한다.

### 판매 차수

공지가 판매 차수(1차/2차 MD, 사전예약 등)를 명시적으로 나눈 경우에만 해당 `scheduleItemId`로 분류한다. 일반적인 경우에는 분류하지 않는다(`scheduleItemId` 비움).

## 데이터 모델 (계획)

```prisma
model HubEventGoodsItem {
  id             String   @id @default(cuid(2))
  hubEventId     String
  scheduleItemId String?   // 공지가 판매 차수를 나눈 경우에만
  name           String
  groupLabel     String?   // "아크릴", "의류", "특전" 등 표시용 그룹
  memberIds      String[] @default([])
  priceKrw       Int?
  priceNote      String?   // "랜덤 1종", "세트 구성" 등
  salesChannel   String    // onsite | online | both
  purchaseLimit  Int?
  limitNote      String?
  isBonus        Boolean  @default(false)    // 구매 특전
  purchaseUrl    String?
  image          Json?     // HubEventImage 정책 재사용
  sortOrder      Int      @default(0)
  cancelledAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  hubEvent HubEvent @relation(fields: [hubEventId], references: [id], onDelete: Cascade)

  @@index([hubEventId, sortOrder])
}
```

JSON 컬럼 대신 자식 테이블을 쓰는 이유: 기존 `scheduleItems`/`links` 패턴과 일관되고, 항목별 검증·정렬·차수 연결·감사 로그가 쉽다.

### 검증 정책 (`hubEventGoodsPolicy.ts`, 계획)

- `memberIds`는 카탈로그의 `active`/`upcoming` 멤버만 허용한다. 전 멤버는 거부한다. Gangzi는 `gamja`의 representative로 취급한다.
- `image`는 기존 이미지 정책 검증을 그대로 쓰고 바이너리 필드를 거부한다. 팬딩 CDN URL은 운영 정책상 쓰지 않는다.
- `purchaseUrl`은 HTTPS만, `priceKrw`·`purchaseLimit`는 0 이상, `scheduleItemId`는 같은 행사의 일정이어야 한다.
- 이름·메모는 사실 정보만 받고 길이 제한을 둔다 (값은 구현 시 기존 schedule label 제한에 맞춘다).

## API 계약 (계획)

공개:

- `GET /v1/hub-events/:id` 상세 응답에만 `goodsItems?: HubEventGoodsItem[]`를 추가한다 (취소된 항목 제외, `sortOrder` 순).
- 목록·캘린더·위젯 응답에는 넣지 않는다. 필요하면 목록에 `goodsCount?: number`만 추가한다.
- 선택 필드라 기존 클라이언트는 무시한다.

어드민:

- 일정 항목과 같은 형태: `POST /v1/admin/hub-events/:id/goods-items`, `PATCH|DELETE /:id/goods-items/:itemId`, `POST /:id/goods-items/:itemId/restore`, `PUT /:id/goods-items/order`.
- 일괄 교체: `PUT /v1/admin/hub-events/:id/goods-items` — 전체 목록을 검증한 뒤 트랜잭션으로 교체하고, 실패 시 항목별 오류를 반환한다.
- 변경 시 `HubEvent.revision`을 올리고 `HubEventAuditLog`에 기록한다.

동기화 대상: `shared/schemas/domain.ts`, `shared/openapi/openapi.yaml`, memory 모드 시드 (실제 이미지 없이 예시만).

## 어드민 콘솔 (계획)

- 행사 편집 화면에 "굿즈 목록" 섹션 추가. 기본 노출 분류: `online_goods`, `offline_popup`, `online_collab`, `offline_collab`, `offline_concert`.
- 표 편집기: 이름, 그룹, 멤버, 가격, 채널, 제한, 특전 여부, 판매 차수(선택).
- 붙여넣기 가져오기: TSV 또는 JSON → 미리보기 → 검증 → 일괄 교체.
- `stellive-event-brief` 스킬이 공지 텍스트에서 `goodsItems` JSON 초안을 만들도록 확장한다 (출처 허용 범위는 그대로).

## 모바일 (계획)

- 상세 화면에 "굿즈" 섹션: `groupLabel` 또는 멤버별 그룹, 가격·채널(현장/온라인)·구매 제한·특전 배지, 8개 초과 시 접기, 멤버 필터 칩.
- 이미지가 없거나 정책상 표시할 수 없으면 플레이스홀더.
- 목록 행에는 `goodsCount`만 표시 (예: "굿즈 32종").
- 캐시와 stale 표시는 기존 상세 캐시 정책을 따른다.
- 변경 지점
  - Android: `core/network/HubApiModels.kt`, 상세 화면, `feature/goodsevents/GoodsEventsScreenController.kt`
  - iOS: 모델, `Services/ServerHubStore.swift`, `Views/HubEventDetailView.swift`

## 구현 단계

| 단계 | 내용 | 병렬 |
|---|---|---|
| 1 | 공유 계약, Prisma 마이그레이션, 검증 정책, 어드민/공개 API, 백엔드 테스트 | 단독 (계약 기준점) |
| 2 | 어드민 콘솔 UI, 붙여넣기 가져오기 | 1 이후 |
| 3 | Android 상세 섹션 / iOS 상세 섹션 | 서로, 그리고 2와 병렬 가능 |
| 3 | 구매 체크리스트 (각 플랫폼 작업에 포함) | 플랫폼 작업과 함께 |
| 4 | 스킬 확장 (`goodsItems` 초안 출력) | 2와 병렬 |

빌드 메모리 예산(`.agents/skills/memory-budget`) 때문에 Gradle과 xcodebuild는 동시에 실행하지 않는다.

## 구매 체크리스트 (모바일 로컬)

- 범위: 기기 로컬 상태만. 서버 전송·동기화·푸시 없음 (모바일이 소유하는 로컬 상태 범위).
- 키: `eventId` + `goodsItemId`. 값: 수량(1 이상). 체크 시 수량 1, `purchaseLimit`가 있으면 그 값을 상한으로 한다.
- 상세 화면 굿즈 행마다 체크박스와 수량 조절, 섹션 상단에 "선택 n개 · 예상 합계 ₩X" 요약 (`priceKrw`가 없는 항목은 합계에서 빼고 "가격 미정 포함" 표시).
- 상세 API가 200으로 최신 목록을 돌려주면, 목록에 없는 `goodsItemId` 항목은 정리한다. 네트워크 실패·캐시 표시 중에는 정리하지 않는다.
- 행사별 "체크리스트 비우기" 제공.
- 기존 예약 기능(`ReservationKind.PURCHASE`)과의 연결은 이번 범위 밖.

## 범위 밖

- 팬딩 등 판매 플랫폼 상품 페이지 자동 수집, 이미지 다운로드·번들링.
- 품절·재고 상태 관리와 품절·재입고 푸시 알림.
- 구매 체크리스트의 서버 동기화.
- 모바일에서 굿즈 생성·수정.

## 확정된 결정 (2026-10-07)

1. 품절 상태(`availability`) 없이 정적 목록만 둔다.
2. 멤버별 변형은 항목 1개 + `memberIds`로 표현한다 (권장안 기본 적용).
3. 판매 차수는 공지가 나눈 경우에만 `scheduleItemId`로 분류한다.
4. 구매 체크리스트를 이번 범위에 포함한다 (모바일 로컬).

## 수용 기준

- 어드민에서 굿즈 목록을 일괄 입력·수정·정렬·취소할 수 있고, 검증 실패 시 항목별 오류가 보인다.
- 게시된 행사의 `GET /v1/hub-events/:id`가 `goodsItems`를 반환하고, 목록·캘린더·위젯 응답 크기는 변하지 않는다.
- 전 멤버 ID, 비 HTTPS URL, 이미지 바이너리 필드는 저장되지 않는다.
- Android/iOS 상세 화면이 굿즈 섹션을 표시하고, `goodsItems`가 없으면 섹션을 숨긴다.
- 구매 체크리스트가 앱 재시작 후에도 유지되고, 서버 목록에서 사라진 항목은 정상 로드 시 정리된다.
- 팬딩 도메인이 fetcher 허용 출처나 서버 수집 경로에 추가되지 않는다.

## 공식 MD 리스트 이미지 갤러리 (방식 A)

상태: 구현 진행 중 (브랜치 `feat/hub-event-goods-gallery`, 기준 태그 `goods-gallery-baseline`).

### 목적

공식 공지의 MD 리스트·특전 리스트 이미지(여러 상품을 한 장에 모은 페이지 이미지)를 굿즈 섹션 상단 갤러리로 보여준다. 상품 목록을 입력하지 못한 이미지 전용 공지도 갤러리만으로 정보를 제공한다. 상품별로 잘라낸 썸네일은 만들지 않는다 (이미지 다운로드·재가공 금지).

### 화면 (기본안)

- 굿즈 섹션 맨 위에 "공식 MD 리스트" 줄: 장수, 공지 링크, 가로 썸네일 스트립, 출처 문구. 기본 펼침.
- MD 리스트와 특전 리스트는 공지 순서대로 한 스트립에 이어서 표시한다.
- 썸네일을 누르면 전체 화면 뷰어: 위치 표시(`altText` 또는 "이미지 n / N"), 공지 열기, 핀치 확대, 좌우 넘기기, 출처 표시.
- `goodsItems`가 비어 있고 갤러리만 있으면 "상품 목록은 아직 등록되지 않았어요" 안내와 구매 페이지 버튼을 표시한다.
- 썸네일은 축소 디코딩하고 원본 크기는 뷰어에서 해당 장을 볼 때만 불러온다.

### 데이터 계약

- `HubEvent.goodsListImages?: HubEventImage[]` — 공지 순서, 최대 20장. 상세 응답에만 포함하고 목록·캘린더·위젯·부트스트랩에는 넣지 않는다.
- 저장: `HubEvent.goodsListImages Json?` (nullable 컬럼 추가만 하는 additive 마이그레이션).
- 검증: 장마다 기존 이미지 정책 검증을 재사용한다. `official_runtime_url`은 호스트 허용 목록(`stellive.me`와 그 하위 도메인, `pbs.twimg.com`)만 받는다. 이 허용 목록은 갤러리 이미지에만 적용하고 기존 이벤트 이미지 동작은 바꾸지 않는다.
- 공개 응답은 표시 가능한 이미지(`canDisplayHubEventImage`)만 남기고, 하나도 없으면 필드를 생략한다.

### 롤백 설계

변경을 기존 코드와 분리해 단계별로 되돌릴 수 있게 한다.

| 단계 | 방법 | 효과 | 앱 배포 필요 |
|---|---|---|---|
| L1 즉시 끄기 | 서버 환경 변수 `HUB_EVENT_GOODS_GALLERY_ENABLED=false` 후 재시작 | 공개 상세 응답에서 `goodsListImages` 제거 → 앱이 갤러리를 숨김. 어드민 저장 데이터는 유지 | 없음 |
| L2 코드 되돌리기 | `git revert` 갤러리 커밋들, 또는 배포 전이면 `git reset --hard goods-gallery-baseline` | 갤러리 코드 전체 제거 | 앱은 다음 릴리스 |
| L3 DB 정리 | L2 배포 후 `ALTER TABLE "HubEvent" DROP COLUMN "goodsListImages";` 실행 및 해당 마이그레이션 폴더 제거 | 컬럼 삭제 | 없음 |
| 스킬 | `.agents/skills/stellive-event-brief/.rollback/pre-goods-gallery-2026-10-07/`의 파일로 덮어쓰기 | 스킬 출력에서 `goodsListImages` 제거 | 없음 |

코드 원칙:

- 갤러리 로직과 UI는 새 파일에 둔다. 기존 파일에는 호출 지점 한두 줄만 추가하고, 각 지점을 커밋 메시지와 아래 목록에 남긴다.
- 모바일은 필드가 없으면 갤러리를 렌더링하지 않는다 (L1 이 그대로 동작하는 조건).
- 영역별(백엔드, 어드민, Android, iOS) 커밋을 분리해 부분 되돌리기가 가능하게 한다.

기존 파일 접점 목록: 구현 후 기록한다.
