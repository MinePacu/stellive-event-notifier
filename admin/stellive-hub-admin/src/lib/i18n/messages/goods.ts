import { defineMessages } from '../define'

// Ported from the legacy backend admin console (adminI18n.ts goods.* / goodsGallery.*).
export const goodsMessages = defineMessages({
  en: {
    'goods.tab': 'Goods ({count})',
    'goods.title': 'Goods list',
    'goods.help':
      'Static list of goods announced for this event. Sold-out status is not tracked. Images are not edited here.',
    'goods.add': 'Add goods item',
    'goods.empty': 'No goods items yet.',
    'goods.loading': 'Loading goods list...',
    'goods.loadFailed': 'Could not load the goods list: {reason}',
    'goods.collapsedHelp':
      'This category usually has no goods list. Expand it only if this event announces goods.',
    'goods.show': 'Show goods list',
    'goods.hide': 'Hide goods list',
    'goods.saveBeforeAdd': 'Save this event as a draft before adding goods?',
    'goods.saveFirst':
      'Save the event as a draft before replacing its goods list.',
    'goods.dialogCreate': 'Add goods item',
    'goods.dialogEdit': 'Edit goods item',
    'goods.save': 'Save goods item',
    'goods.name': 'Name',
    'goods.groupLabel': 'Group',
    'goods.members': 'Members',
    'goods.membersHelp': 'Leave empty for goods that are not tied to members.',
    'goods.membersUnavailable':
      'The member catalog could not be loaded, so members cannot be picked or resolved by name.',
    'goods.price': 'Price (KRW)',
    'goods.priceNote': 'Price note',
    'goods.salesChannel': 'Sales channel',
    'goods.channelOnsite': 'On-site',
    'goods.channelOnline': 'Online',
    'goods.channelBoth': 'On-site and online',
    'goods.purchaseLimit': 'Purchase limit',
    'goods.limitNote': 'Limit note',
    'goods.isBonus': 'Bonus item (special benefit)',
    'goods.purchaseUrl': 'Purchase URL',
    'goods.salesPhase': 'Sales phase',
    'goods.salesPhaseNone': 'None',
    'goods.bonus': 'Bonus',
    'goods.limitBadge': 'Limit {count}',
    'goods.priceUnset': 'Price not set',
    'goods.cancelled': 'Cancelled',
    'goods.cancel': 'Cancel item',
    'goods.restore': 'Restore item',
    'goods.untitled': 'Untitled item',
    'goods.importTitle': 'Paste import',
    'goods.importHelp':
      'Paste JSON ({ "goodsItems": [...] } or a bare array) or a TSV copied from a spreadsheet with a header row. Replacing deletes every current goods item, including cancelled ones.',
    'goods.importPlaceholder':
      '{ "goodsItems": [ { "name": "...", "salesChannel": "online" } ] }',
    'goods.importPreview': 'Preview',
    'goods.importApply': 'Validate and replace',
    'goods.importFormat': 'Detected format: {format}',
    'goods.importRows': '{count} rows parsed',
    'goods.importHasErrors':
      '{count} errors. Fix the input and preview again before replacing.',
    'goods.importReady':
      'No parse errors. The server validates the full list again when you replace.',
    'goods.importStale':
      'The input changed after the last preview. Preview again before replacing.',
    'goods.importNothing': 'Run a preview first.',
    'goods.importConfirm':
      '{existing} existing item(s), including cancelled ones, will be deleted and replaced by {count} new item(s). This cannot be undone.',
    'goods.importServerErrors':
      'The server rejected the list. Nothing was written.',
    'goods.rowNumber': '#',
    'goods.rowErrors': 'Row {row}',
    'goods.globalErrors': 'Input errors',
    'goods.err.empty': 'Nothing to import.',
    'goods.err.json_parse': 'Invalid JSON: {detail}',
    'goods.err.json_shape':
      'JSON must be an array or an object with a goodsItems array.',
    'goods.err.too_many': 'At most {detail} goods items are allowed.',
    'goods.err.item_not_object': 'Each item must be an object.',
    'goods.err.unknown_column': 'Unknown column: {detail}',
    'goods.err.duplicate_column': 'Duplicate column: {detail}',
    'goods.err.missing_name_column': 'The header row needs a name column.',
    'goods.err.extra_cells': 'This row has more cells than the header.',
    'goods.err.number_invalid': 'Not a valid number: {detail}',
    'goods.err.price_invalid': 'Not a valid price: {detail}',
    'goods.err.channel_invalid': 'Unknown sales channel: {detail}',
    'goods.err.bool_invalid': 'Not a yes/no value: {detail}',
    'goods.err.member_unknown': 'Unknown member: {detail}',
    'goods.err.schedule_label_unmatched':
      'No active schedule item has the label: {detail}',
    'goods.err.schedule_label_ambiguous':
      'More than one schedule item has the label: {detail}',
    'goods.err.schedule_conflict':
      'scheduleItemId and scheduleItemLabel point to different schedule items: {detail}',
    'goods.err.name_required': 'Name is required.',
    'goods.err.unknown': 'Invalid value.',
    'goodsGallery.title': 'Official MD list images',
    'goodsGallery.help':
      "Page images from the official notice that list the MD / bonus items, in notice order (max 20). Shown at the top of the app's goods section. Images are linked, never downloaded.",
    'goodsGallery.count': '{count} / {max}',
    'goodsGallery.add': 'Add image',
    'goodsGallery.remove': 'Remove image',
    'goodsGallery.moveUp': 'Move up',
    'goodsGallery.moveDown': 'Move down',
    'goodsGallery.rowLabel': 'Image {n}',
    'goodsGallery.url': 'Image URL (https)',
    'goodsGallery.kind': 'List type',
    'goodsGallery.kindOption.md': 'MD list',
    'goodsGallery.kindOption.bonus': 'Bonus list',
    'goodsGallery.altText': 'Alt text',
    'goodsGallery.policyState': 'Image policy',
    'goodsGallery.sourceLabel': 'Source label',
    'goodsGallery.sourceUrl': 'Source URL',
    'goodsGallery.thumbFailed': 'Preview unavailable',
    'goodsGallery.empty': 'No images yet. Add one or paste several URLs below.',
    'goodsGallery.importTitle': 'Paste several URLs',
    'goodsGallery.importHelp':
      'One image URL per line, or the stellive-event-brief JSON ({ "goodsListImages": [...] } or a bare array). Entries default to the MD list; add "kind": "bonus" in JSON for bonus lists. Missing alt text becomes "MD 리스트 N" / "특전 리스트 N" (numbered per type); the source label and URL default to the official notice.',
    'goodsGallery.importPlaceholder':
      'https://www.stellive.me/images/md-1.jpg\nhttps://www.stellive.me/images/md-2.jpg',
    'goodsGallery.importAppend': 'Add to list',
    'goodsGallery.importReplace': 'Replace list',
    'goodsGallery.importReplaceConfirm':
      '{existing} current image(s) will be removed and replaced by {count} pasted image(s). Nothing is saved until you save the event.',
    'goodsGallery.importRow': 'Entry {row}',
    'goodsGallery.importErrors': '{count} error(s). Nothing was added.',
    'goodsGallery.importWarnings':
      '{count} warning(s). The images were added; review them below.',
    'goodsGallery.importApplied':
      '{count} image(s) added to the editor. Save the event to publish the change.',
    'goodsGallery.policy.none': 'None',
    'goodsGallery.policy.official_runtime_url': 'Official runtime URL',
    'goodsGallery.policy.third_party_allowed': 'Third-party allowed',
    'goodsGallery.policy.verify_required': 'Verify required',
    'goodsGallery.policy.blocked': 'Blocked',
    'goodsGallery.err.empty': 'Nothing to import.',
    'goodsGallery.err.json_parse': 'Invalid JSON: {detail}',
    'goodsGallery.err.json_shape':
      'JSON must be an array or an object with a goodsListImages array.',
    'goodsGallery.err.too_many':
      'At most {detail} images are allowed in total.',
    'goodsGallery.err.item_not_object':
      'Each entry must be a URL string or an object.',
    'goodsGallery.err.field_not_string': 'This field must be a string.',
    'goodsGallery.err.policy_invalid': 'Unknown image policy: {detail}',
    'goodsGallery.err.kind_invalid':
      'Unknown list type (use md or bonus): {detail}',
    'goodsGallery.err.url_required': 'Image URL is required.',
    'goodsGallery.err.url_invalid': 'Not a valid URL.',
    'goodsGallery.err.url_not_https': 'Only https URLs are allowed.',
    'goodsGallery.err.source_url_not_https':
      'Source URL must be a valid https URL.',
    'goodsGallery.err.source_url_required':
      'Source URL is required for this policy.',
    'goodsGallery.err.source_label_required':
      'Source label is required for this policy.',
    'goodsGallery.err.unknown': 'Invalid value.',
    'goodsGallery.warn.host_not_allowed':
      'Host {detail} is not allowed for official runtime URLs (stellive.me, *.stellive.me, pbs.twimg.com); the server will reject it.',
    'goodsGallery.warn.duplicate_url': 'This URL is already in the list.',
    'goodsGallery.warn.unknown': 'Check this value.',
    'goods.saveDraftThenAdd': 'Save draft and add goods',
    'goods.importConfirmTitle': 'Replace the goods list?',
    'goodsGallery.importReplaceConfirmTitle': 'Replace the gallery?',
    'goodsGallery.unsaved':
      'Unsaved gallery changes. Save the event to apply them.',
  },
  ko: {
    'goods.tab': '굿즈 목록 ({count})',
    'goods.title': '굿즈 목록',
    'goods.help':
      '이 행사에서 공지된 굿즈의 정적 목록입니다. 품절 상태는 관리하지 않으며 이미지는 여기서 편집하지 않습니다.',
    'goods.add': '굿즈 추가',
    'goods.empty': '등록된 굿즈가 없습니다.',
    'goods.loading': '굿즈 목록을 불러오는 중...',
    'goods.loadFailed': '굿즈 목록을 불러오지 못했습니다: {reason}',
    'goods.collapsedHelp':
      '이 분류는 보통 굿즈 목록이 없습니다. 이 행사에서 굿즈를 공지한 경우에만 펼치세요.',
    'goods.show': '굿즈 목록 펼치기',
    'goods.hide': '굿즈 목록 접기',
    'goods.saveBeforeAdd':
      '굿즈를 추가하기 전에 이 행사를 초안으로 저장할까요?',
    'goods.saveFirst':
      '굿즈 목록을 교체하려면 먼저 행사를 초안으로 저장하세요.',
    'goods.dialogCreate': '굿즈 추가',
    'goods.dialogEdit': '굿즈 수정',
    'goods.save': '굿즈 저장',
    'goods.name': '상품명',
    'goods.groupLabel': '그룹',
    'goods.members': '멤버',
    'goods.membersHelp': '멤버와 무관한 굿즈는 비워 두세요.',
    'goods.membersUnavailable':
      '멤버 카탈로그를 불러오지 못해 멤버를 선택하거나 이름으로 변환할 수 없습니다.',
    'goods.price': '가격 (원)',
    'goods.priceNote': '가격 메모',
    'goods.salesChannel': '판매 채널',
    'goods.channelOnsite': '현장',
    'goods.channelOnline': '온라인',
    'goods.channelBoth': '현장·온라인',
    'goods.purchaseLimit': '구매 제한',
    'goods.limitNote': '제한 메모',
    'goods.isBonus': '특전 (구매 혜택)',
    'goods.purchaseUrl': '구매 URL',
    'goods.salesPhase': '판매 차수',
    'goods.salesPhaseNone': '없음',
    'goods.bonus': '특전',
    'goods.limitBadge': '구매 제한 {count}',
    'goods.priceUnset': '가격 미정',
    'goods.cancelled': '취소됨',
    'goods.cancel': '굿즈 취소',
    'goods.restore': '굿즈 복원',
    'goods.untitled': '이름 없는 굿즈',
    'goods.importTitle': '붙여넣기 가져오기',
    'goods.importHelp':
      'JSON({ "goodsItems": [...] } 또는 배열) 또는 스프레드시트에서 복사한 TSV(첫 줄은 헤더)를 붙여넣으세요. 교체하면 취소된 항목을 포함한 현재 굿즈가 모두 삭제됩니다.',
    'goods.importPlaceholder':
      '{ "goodsItems": [ { "name": "...", "salesChannel": "online" } ] }',
    'goods.importPreview': '미리보기',
    'goods.importApply': '검증 후 교체',
    'goods.importFormat': '감지된 형식: {format}',
    'goods.importRows': '{count}행을 읽었습니다',
    'goods.importHasErrors':
      '오류 {count}건. 입력을 고친 뒤 다시 미리보기 하세요.',
    'goods.importReady':
      '파싱 오류가 없습니다. 교체할 때 서버가 전체 목록을 다시 검증합니다.',
    'goods.importStale':
      '마지막 미리보기 이후 입력이 바뀌었습니다. 다시 미리보기 하세요.',
    'goods.importNothing': '먼저 미리보기를 실행하세요.',
    'goods.importConfirm':
      '취소된 항목을 포함해 기존 {existing}개가 삭제되고 새 {count}개로 교체됩니다. 되돌릴 수 없습니다.',
    'goods.importServerErrors':
      '서버가 목록을 거부했습니다. 저장된 내용은 없습니다.',
    'goods.rowNumber': '#',
    'goods.rowErrors': '{row}행',
    'goods.globalErrors': '입력 오류',
    'goods.err.empty': '가져올 내용이 없습니다.',
    'goods.err.json_parse': 'JSON 형식이 올바르지 않습니다: {detail}',
    'goods.err.json_shape':
      'JSON은 배열이거나 goodsItems 배열이 있는 객체여야 합니다.',
    'goods.err.too_many': '굿즈는 최대 {detail}개까지 입력할 수 있습니다.',
    'goods.err.item_not_object': '각 항목은 객체여야 합니다.',
    'goods.err.unknown_column': '알 수 없는 열: {detail}',
    'goods.err.duplicate_column': '중복된 열: {detail}',
    'goods.err.missing_name_column': '헤더 행에 상품명 열이 필요합니다.',
    'goods.err.extra_cells': '이 행에 헤더보다 많은 칸이 있습니다.',
    'goods.err.number_invalid': '올바른 숫자가 아닙니다: {detail}',
    'goods.err.price_invalid': '올바른 가격이 아닙니다: {detail}',
    'goods.err.channel_invalid': '알 수 없는 판매 채널: {detail}',
    'goods.err.bool_invalid': '예/아니오 값이 아닙니다: {detail}',
    'goods.err.member_unknown': '알 수 없는 멤버: {detail}',
    'goods.err.schedule_label_unmatched':
      '이 라벨의 활성 일정 항목이 없습니다: {detail}',
    'goods.err.schedule_label_ambiguous':
      '같은 라벨의 일정 항목이 둘 이상입니다: {detail}',
    'goods.err.schedule_conflict':
      'scheduleItemId와 scheduleItemLabel이 서로 다른 일정을 가리킵니다: {detail}',
    'goods.err.name_required': '상품명은 필수입니다.',
    'goods.err.unknown': '값이 올바르지 않습니다.',
    'goodsGallery.title': '공식 MD 리스트 이미지',
    'goodsGallery.help':
      '공식 공지의 MD·특전 리스트 페이지 이미지를 공지 순서대로 등록합니다 (최대 20장). 앱 굿즈 섹션 맨 위에 표시됩니다. 이미지는 링크만 저장하며 내려받지 않습니다.',
    'goodsGallery.count': '{count} / {max}장',
    'goodsGallery.add': '이미지 추가',
    'goodsGallery.remove': '이미지 삭제',
    'goodsGallery.moveUp': '위로 이동',
    'goodsGallery.moveDown': '아래로 이동',
    'goodsGallery.rowLabel': '이미지 {n}',
    'goodsGallery.url': '이미지 URL (https)',
    'goodsGallery.kind': '리스트 종류',
    'goodsGallery.kindOption.md': 'MD 리스트',
    'goodsGallery.kindOption.bonus': '특전',
    'goodsGallery.altText': '대체 텍스트',
    'goodsGallery.policyState': '이미지 정책',
    'goodsGallery.sourceLabel': '출처 문구',
    'goodsGallery.sourceUrl': '출처 URL',
    'goodsGallery.thumbFailed': '미리보기를 불러오지 못했어요',
    'goodsGallery.empty':
      '등록된 이미지가 없습니다. 이미지를 추가하거나 아래에 URL 여러 개를 붙여넣으세요.',
    'goodsGallery.importTitle': '여러 URL 붙여넣기',
    'goodsGallery.importHelp':
      '한 줄에 이미지 URL 하나씩, 또는 stellive-event-brief JSON ({ "goodsListImages": [...] } 또는 배열)을 붙여넣습니다. JSON에서 "kind": "bonus"를 주면 특전 리스트이고 기본은 MD 리스트입니다. 대체 텍스트가 없으면 종류별로 "MD 리스트 N" / "특전 리스트 N"으로 채우고, 출처 문구와 URL은 공식 공지를 기본값으로 씁니다.',
    'goodsGallery.importPlaceholder':
      'https://www.stellive.me/images/md-1.jpg\nhttps://www.stellive.me/images/md-2.jpg',
    'goodsGallery.importAppend': '목록에 추가',
    'goodsGallery.importReplace': '목록 교체',
    'goodsGallery.importReplaceConfirm':
      '현재 {existing}장이 제거되고 붙여넣은 {count}장으로 바뀝니다. 행사를 저장하기 전에는 아무것도 저장되지 않습니다.',
    'goodsGallery.importRow': '{row}번째 항목',
    'goodsGallery.importErrors':
      '오류 {count}건. 아무것도 추가하지 않았습니다.',
    'goodsGallery.importWarnings':
      '경고 {count}건. 이미지는 추가했으니 아래에서 확인하세요.',
    'goodsGallery.importApplied':
      '이미지 {count}장을 편집기에 추가했습니다. 행사를 저장해야 반영됩니다.',
    'goodsGallery.policy.none': '없음',
    'goodsGallery.policy.official_runtime_url': '공식 런타임 URL',
    'goodsGallery.policy.third_party_allowed': '제3자 허용',
    'goodsGallery.policy.verify_required': '확인 필요',
    'goodsGallery.policy.blocked': '차단',
    'goodsGallery.err.empty': '가져올 내용이 없습니다.',
    'goodsGallery.err.json_parse': 'JSON 형식이 올바르지 않습니다: {detail}',
    'goodsGallery.err.json_shape':
      'JSON은 배열이거나 goodsListImages 배열을 가진 객체여야 합니다.',
    'goodsGallery.err.too_many':
      '전체 이미지는 최대 {detail}장까지 가능합니다.',
    'goodsGallery.err.item_not_object':
      '각 항목은 URL 문자열이거나 객체여야 합니다.',
    'goodsGallery.err.field_not_string': '이 필드는 문자열이어야 합니다.',
    'goodsGallery.err.policy_invalid': '알 수 없는 이미지 정책: {detail}',
    'goodsGallery.err.kind_invalid':
      '알 수 없는 리스트 종류입니다 (md 또는 bonus): {detail}',
    'goodsGallery.err.url_required': '이미지 URL은 필수입니다.',
    'goodsGallery.err.url_invalid': '올바른 URL이 아닙니다.',
    'goodsGallery.err.url_not_https': 'https URL만 사용할 수 있습니다.',
    'goodsGallery.err.source_url_not_https':
      '출처 URL은 올바른 https URL이어야 합니다.',
    'goodsGallery.err.source_url_required':
      '이 정책에서는 출처 URL이 필수입니다.',
    'goodsGallery.err.source_label_required':
      '이 정책에서는 출처 문구가 필수입니다.',
    'goodsGallery.err.unknown': '값이 올바르지 않습니다.',
    'goodsGallery.warn.host_not_allowed':
      '{detail} 호스트는 공식 런타임 URL에 허용되지 않습니다 (stellive.me, *.stellive.me, pbs.twimg.com). 서버가 거부합니다.',
    'goodsGallery.warn.duplicate_url': '이미 목록에 있는 URL입니다.',
    'goodsGallery.warn.unknown': '값을 확인하세요.',
    'goods.saveDraftThenAdd': '초안 저장 후 굿즈 추가',
    'goods.importConfirmTitle': '굿즈 목록을 교체할까요?',
    'goodsGallery.importReplaceConfirmTitle': '갤러리를 교체할까요?',
    'goodsGallery.unsaved':
      '저장하지 않은 갤러리 변경이 있습니다. 행사를 저장해야 반영됩니다.',
  },
})
