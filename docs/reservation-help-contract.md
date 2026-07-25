# 예약·구매 도움말 공통 계약

Android와 iOS의 예약·구매 도움말은 플랫폼별 네이티브 UI를 사용하되 아래 의미 구조를 동일하게 유지한다.

## 도움말 상태

| 상태 ID | 표시 조건 | 톤 | 기본 동작 |
| --- | --- | --- | --- |
| `getting_started` | 활성 임시 항목과 저장 내역이 없음 | `info` | 3단계 사용 흐름 안내 |
| `pending` | 만료되지 않은 임시 항목이 하나 이상 있음 | `warning` | `view_pending` |
| `manage_records` | 임시 항목은 없고 저장 내역이 있음 | `info` | 예정 내역이 있으면 `view_upcoming` |

`pending` 상태는 활성 임시 항목 수와 가장 먼저 만료되는 항목의 대략적인 남은 시간을 표시한다.

## 도움말 섹션

| 섹션 ID | 톤 | 선택 동작 | 핵심 의미 |
| --- | --- | --- | --- |
| `pending_draft` | `warning` | `view_pending` | 링크를 열면 생기는 임시 항목은 최대 2시간 뒤 정리되며 외부 완료 여부를 자동 검증하지 않음 |
| `linkless_add` | `info` | `add_without_link` | 상세 링크를 찾지 못해도 내역 추가 가능 |
| `list_groups` | `normal` | `view_upcoming` | 완료 상태와 일정에 따라 예정/지난 내역으로 구분 |
| `local_storage` | `security` | 없음 | 서버 미전송, 기기 로컬 저장, 백업 제외 |
| `detail_actions` | `info` | `edit_current_record` | 링크 열기와 상태·일정·장소·추가 정보 수정 |
| `link_priority` | `normal` | 없음 | 상세 링크, 제공사 내역 URL, 최초 링크 순서 |
| `user_overrides` | `info` | 없음 | 사용자가 수정한 제목·일정·장소를 우선 표시 |
| `official_event` | `warning` | 없음 | 공식 정보 변경·취소가 사용자 상태와 수정값을 자동 변경하지 않음 |
| `delete_warning` | `danger` | 없음 | 앱 내역 삭제는 외부 예매·주문·예약 취소가 아님 |

## FAQ

| FAQ ID | 톤 | 선택 동작 | 답변 방향 |
| --- | --- | --- | --- |
| `return_prompt_missing` | `warning` | `view_pending` | 복귀 안내가 없어도 확인 필요에서 직접 추가 |
| `detail_link_missing` | `info` | `add_without_link` | 링크 없이 추가 가능 |
| `duplicate_link` | `warning` | `view_existing_record` | 기존 내역 확인 또는 사용자가 중복 저장 결정 |
| `sensitive_link` | `security` | 없음 | 인증 정보 가능성, 로컬 저장, 백업 제외 |
| `official_event_cancelled` | `warning` | 없음 | 공식 정보가 사용자 상태와 수정값을 자동 변경하지 않음 |

## 동작 ID

| 동작 ID | 대상 |
| --- | --- |
| `view_pending` | 예약·구매 목록의 확인 필요 영역 |
| `add_without_link` | 가장 먼저 만료되는 활성 임시 항목의 추가 화면 |
| `view_upcoming` | 예약·구매 목록의 예정된 내역 영역 |
| `edit_current_record` | 현재 상세 내역의 수정 화면 |
| `view_existing_record` | 중복 링크가 연결된 기존 내역 상세 |

현재 상태에서 대상이 존재하지 않는 동작은 표시하지 않는다.

## 임시 항목 만료 표시

임시 항목의 만료 정책은 최대 2시간으로 유지한다. 화면에는 정확한 초 단위 카운트다운 대신 다음 안정 구간을 사용한다.

- 60분 이상: 올림한 시간 단위
- 10분 이상 60분 미만: 5분 단위로 올림
- 2분 이상 10분 미만: 1분 단위로 올림
- 2분 미만: `곧 자동 정리`
- 만료됨: 활성 임시 항목과 도움말 상태에서 제외

화면 재진입 또는 상태 갱신 때 남은 시간을 다시 계산한다.
