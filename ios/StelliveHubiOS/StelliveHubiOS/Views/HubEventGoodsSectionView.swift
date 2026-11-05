import SwiftUI

struct HubEventGoodsSectionView: View {
    let eventId: String
    let items: [HubEventGoodsItem]

    @EnvironmentObject private var checklist: GoodsChecklistStore
    @EnvironmentObject private var hubStore: MockHubStore
    @Environment(\.openURL) private var openURL
    @State private var memberFilterId: String?
    @State private var isExpanded = false

    private var memberNames: [String: String] {
        Dictionary(hubStore.members.map { ($0.id, $0.koreanName) }, uniquingKeysWith: { first, _ in first })
    }

    var body: some View {
        let presentation = HubEventGoodsPolicy.presentation(
            items: items,
            memberFilterId: memberFilterId,
            isExpanded: isExpanded
        )
        let quantities = checklist.quantities(eventId: eventId)
        let summary = HubEventGoodsPolicy.summary(items: items, quantities: quantities)

        VStack(alignment: .leading, spacing: 14) {
            summaryRow(summary)
            if presentation.showsMemberFilter {
                memberFilterChips(presentation)
            }
            ForEach(presentation.groups) { group in
                VStack(alignment: .leading, spacing: 0) {
                    Text(group.title)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(HubEventDetailColors.muted)
                        .padding(.bottom, 6)
                    ForEach(Array(group.items.enumerated()), id: \.element.id) { index, item in
                        if index > 0 { Divider() }
                        goodsRow(item, quantity: quantities[item.id])
                    }
                }
            }
            if presentation.showsExpandToggle {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { isExpanded.toggle() }
                } label: {
                    Text(presentation.isCollapsed ? "전체 보기 (\(presentation.totalCount))" : "접기")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(17)
        .background(HubEventDetailColors.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func summaryRow(_ summary: HubEventGoodsPolicy.ChecklistSummary) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(summary.text)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(HubEventDetailColors.text)
                .frame(maxWidth: .infinity, alignment: .leading)
            if summary.selectedCount > 0 {
                Button("체크리스트 비우기", role: .destructive) {
                    checklist.clear(eventId: eventId)
                }
                .font(.footnote.weight(.semibold))
            }
        }
    }

    private func memberFilterChips(_ presentation: HubEventGoodsPolicy.Presentation) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                filterChip(title: "전체", isSelected: presentation.selectedMemberId == nil) {
                    memberFilterId = nil
                }
                ForEach(presentation.memberFilterIds, id: \.self) { memberId in
                    filterChip(
                        title: memberNames[memberId] ?? "멤버",
                        isSelected: presentation.selectedMemberId == memberId
                    ) {
                        memberFilterId = memberId
                    }
                }
            }
        }
    }

    private func filterChip(title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .foregroundStyle(isSelected ? Color.white : Color.indigo)
                .background(isSelected ? Color.indigo : Color.indigo.opacity(0.12), in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private func goodsRow(_ item: HubEventGoodsItem, quantity: Int?) -> some View {
        HStack(alignment: .top, spacing: 10) {
            checkControl(item, isChecked: quantity != nil)
            VStack(alignment: .leading, spacing: 5) {
                Text(item.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(HubEventDetailColors.text)
                if let members = HubEventGoodsPolicy.memberSummary(memberIds: item.memberIds, names: memberNames) {
                    Text(members)
                        .font(.caption)
                        .foregroundStyle(HubEventDetailColors.muted)
                }
                Text(HubEventGoodsPolicy.priceText(item))
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(HubEventDetailColors.text)
                chipRow(item)
                ForEach(HubEventGoodsPolicy.secondaryNotes(item), id: \.self) { note in
                    Text(note)
                        .font(.caption)
                        .foregroundStyle(HubEventDetailColors.muted)
                }
                if let quantity {
                    Stepper(
                        value: Binding(
                            get: { quantity },
                            set: { checklist.setQuantity($0, eventId: eventId, item: item) }
                        ),
                        in: 1...max(1, HubEventGoodsPolicy.maxQuantity(item))
                    ) {
                        Text("수량 \(quantity)개")
                            .font(.footnote)
                            .foregroundStyle(HubEventDetailColors.text)
                    }
                }
                if let url = HubEventGoodsPolicy.httpsURL(item.purchaseUrl) {
                    Button { openURL(url) } label: {
                        Label("구매 페이지", systemImage: "arrow.up.right.square")
                            .font(.caption.weight(.semibold))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(Color.indigo)
                    .accessibilityLabel("\(item.name) 구매 페이지, 외부 링크 열기")
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 10)
    }

    @ViewBuilder
    private func checkControl(_ item: HubEventGoodsItem, isChecked: Bool) -> some View {
        if HubEventGoodsPolicy.isCheckable(item) {
            Button {
                checklist.setChecked(!isChecked, eventId: eventId, item: item)
            } label: {
                Image(systemName: isChecked ? "checkmark.square.fill" : "square")
                    .font(.title3)
                    .foregroundStyle(isChecked ? Color.indigo : HubEventDetailColors.muted)
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(item.name) 구매 체크")
            .accessibilityValue(isChecked ? "선택됨" : "선택 안 됨")
        } else {
            Image(systemName: "gift")
                .font(.title3)
                .foregroundStyle(HubEventDetailColors.muted)
                .frame(width: 28, height: 28)
                .accessibilityHidden(true)
        }
    }

    private func chipRow(_ item: HubEventGoodsItem) -> some View {
        var labels: [String] = []
        if let channel = item.salesChannel { labels.append(channel.displayName) }
        if let limit = HubEventGoodsPolicy.purchaseLimitChip(item) { labels.append(limit) }
        if item.isBonus { labels.append("특전") }
        return HStack(spacing: 6) {
            ForEach(labels, id: \.self) { label in
                Text(label)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Color.indigo)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.indigo.opacity(0.12), in: Capsule())
            }
        }
    }
}
