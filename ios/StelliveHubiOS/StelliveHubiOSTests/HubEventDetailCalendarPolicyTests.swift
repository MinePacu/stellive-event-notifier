import XCTest
@testable import StelliveHubiOS

final class HubEventDetailCalendarPolicyTests: XCTestCase {
    private let june1 = HubEventDetailCalendarDate(year: 2026, month: 6, day: 1)
    private let june2 = HubEventDetailCalendarDate(year: 2026, month: 6, day: 2)
    private let june3 = HubEventDetailCalendarDate(year: 2026, month: 6, day: 3)

    func testNoDatesIsHidden() {
        let presentation = makePresentation(event())

        XCTAssertEqual(presentation.mode, .hidden)
        XCTAssertNil(presentation.initialSelectedDate)
        XCTAssertNil(presentation.availableMonthRange)
    }

    func testSingleParentDateUsesCompactMode() {
        let presentation = makePresentation(
            event(startsAt: "2026-06-01T00:00:00Z", endsAt: "2026-06-01T12:00:00Z")
        )

        XCTAssertEqual(presentation.mode, .compactDate)
        XCTAssertEqual(presentation.initialSelectedDate, june1)
    }

    func testMultipleSchedulesOnSameDateRemainCompact() {
        let presentation = makePresentation(
            event(scheduleItems: [
                schedule("second", startsAt: "2026-06-01T02:00:00Z"),
                schedule("first", startsAt: "2026-06-01T01:00:00Z"),
            ])
        )

        XCTAssertEqual(presentation.mode, .compactDate)
        XCTAssertEqual(presentation.scheduleIDs(on: june1), ["first", "second"])
    }

    func testSchedulesOnDifferentDatesUseMonthCalendar() {
        let presentation = makePresentation(
            event(scheduleItems: [
                schedule("first", startsAt: "2026-06-01T01:00:00Z"),
                schedule("second", startsAt: "2026-06-02T01:00:00Z"),
            ])
        )

        XCTAssertEqual(presentation.mode, .monthCalendar)
    }

    func testMultiDayParentMarksInclusiveRange() {
        let presentation = makePresentation(
            event(startsAt: "2026-06-01T00:00:00Z", endsAt: "2026-06-03T00:00:00Z")
        )

        XCTAssertEqual(presentation.mode, .monthCalendar)
        XCTAssertTrue(presentation.day(for: june1).isInParentEventRange)
        XCTAssertTrue(presentation.day(for: june2).isInParentEventRange)
        XCTAssertTrue(presentation.day(for: june3).isInParentEventRange)
    }

    func testDateAndDateTimeUseScheduleTimezoneWithSeoulFallback() {
        let presentation = makePresentation(
            event(scheduleItems: [
                schedule(
                    "date-seoul",
                    startsAt: "2026-06-01T16:00:00Z",
                    precision: .date,
                    timezone: "Asia/Seoul"
                ),
                schedule(
                    "datetime-la",
                    startsAt: "2026-06-01T16:00:00Z",
                    timezone: "America/Los_Angeles"
                ),
                schedule(
                    "invalid-zone",
                    startsAt: "2026-06-01T16:00:00Z",
                    timezone: "Invalid/Timezone"
                ),
            ])
        )

        XCTAssertEqual(presentation.scheduleIDs(on: june1), ["datetime-la"])
        XCTAssertEqual(presentation.scheduleIDs(on: june2), ["date-seoul", "invalid-zone"])
    }

    func testMissingEndProjectsOnlyStartDate() {
        let presentation = makePresentation(
            event(scheduleItems: [
                schedule("start-only", startsAt: "2026-06-01T01:00:00Z"),
            ])
        )

        XCTAssertEqual(presentation.scheduleIDs(on: june1), ["start-only"])
        XCTAssertTrue(presentation.scheduleIDs(on: june2).isEmpty)
    }

    func testMultiDayScheduleProjectsEveryDateOnce() {
        let presentation = makePresentation(
            event(scheduleItems: [
                schedule(
                    "multi",
                    startsAt: "2026-06-01T01:00:00Z",
                    endsAt: "2026-06-03T01:00:00Z"
                ),
            ])
        )

        XCTAssertEqual(presentation.mode, .monthCalendar)
        XCTAssertEqual(presentation.scheduleIDs(on: june1), ["multi"])
        XCTAssertEqual(presentation.scheduleIDs(on: june2), ["multi"])
        XCTAssertEqual(presentation.scheduleIDs(on: june3), ["multi"])
    }

    func testCancelledSchedulesRemainAndCancelledOnlyDayIsMarked() {
        let presentation = makePresentation(
            event(scheduleItems: [
                schedule("cancelled", startsAt: "2026-06-01T01:00:00Z", cancelled: true),
            ])
        )
        let day = presentation.day(for: june1)

        XCTAssertEqual(day.scheduleCount, 1)
        XCTAssertEqual(day.activeScheduleCount, 0)
        XCTAssertTrue(day.hasOnlyCancelledSchedules)
        XCTAssertEqual(presentation.scheduleIDs(on: june1), ["cancelled"])
    }

    func testTenSchedulesUseNinePlusWhileKeepingActualAccessibilityCount() {
        let items = (0..<10).map {
            schedule("item-\($0)", startsAt: "2026-06-01T01:00:00Z", sortOrder: $0)
        }
        let day = makePresentation(event(scheduleItems: items)).day(for: june1)

        XCTAssertEqual(day.badgeText, "9+")
        XCTAssertEqual(day.scheduleCount, 10)
        XCTAssertTrue(day.accessibilityDescription.contains("일정 10개"))
    }

    func testReverseScheduleEndSafelyFallsBackToStartDate() {
        let presentation = makePresentation(
            event(scheduleItems: [
                schedule(
                    "reverse",
                    startsAt: "2026-06-03T01:00:00Z",
                    endsAt: "2026-06-01T01:00:00Z"
                ),
            ])
        )

        XCTAssertEqual(presentation.mode, .compactDate)
        XCTAssertEqual(presentation.scheduleIDs(on: june3), ["reverse"])
        XCTAssertTrue(presentation.scheduleIDs(on: june1).isEmpty)
    }

    func testInitialSelectionPriorityIsHighlightedThenTodayThenFutureThenParent() {
        let containingToday = event(
            startsAt: "2026-06-01T00:00:00Z",
            endsAt: "2026-06-05T00:00:00Z",
            scheduleItems: [
                schedule("highlighted", startsAt: "2026-06-04T01:00:00Z"),
            ]
        )
        XCTAssertEqual(
            makePresentation(containingToday, highlightedID: "highlighted").initialSelectedDate,
            HubEventDetailCalendarDate(year: 2026, month: 6, day: 4)
        )
        XCTAssertEqual(makePresentation(containingToday).initialSelectedDate, june2)

        let futureBeforeParent = event(
            startsAt: "2026-06-10T00:00:00Z",
            scheduleItems: [
                schedule("future", startsAt: "2026-06-08T01:00:00Z"),
            ]
        )
        XCTAssertEqual(
            makePresentation(futureBeforeParent).initialSelectedDate,
            HubEventDetailCalendarDate(year: 2026, month: 6, day: 8)
        )

        let parentOnly = event(startsAt: "2026-06-10T00:00:00Z")
        XCTAssertEqual(
            makePresentation(parentOnly).initialSelectedDate,
            HubEventDetailCalendarDate(year: 2026, month: 6, day: 10)
        )
    }

    func testAvailableMonthRangeCoversEarliestAndLatestDates() {
        let presentation = makePresentation(
            event(
                startsAt: "2026-05-31T00:00:00Z",
                scheduleItems: [
                    schedule("late", startsAt: "2026-07-02T01:00:00Z"),
                ]
            )
        )

        XCTAssertEqual(
            presentation.availableMonthRange,
            HubEventDetailCalendarMonth(year: 2026, month: 5)...HubEventDetailCalendarMonth(year: 2026, month: 7)
        )
        XCTAssertEqual(presentation.displayedMonth, HubEventDetailCalendarMonth(year: 2026, month: 7))
    }

    func testSelectedDateScheduleIDsUseTimelineOrder() {
        let presentation = makePresentation(
            event(scheduleItems: [
                schedule("same-late-sort", startsAt: "2026-06-01T01:00:00Z", sortOrder: 2),
                schedule("later", startsAt: "2026-06-01T02:00:00Z", sortOrder: 0),
                schedule("same-first", startsAt: "2026-06-01T01:00:00Z", sortOrder: 1),
            ])
        )

        XCTAssertEqual(
            presentation.scheduleIDs(on: june1),
            ["same-first", "same-late-sort", "later"]
        )
    }

    func testHighlightedDeepLinkStillExpandsAndScrollsExistingSchedule() {
        XCTAssertEqual(
            HubEventScheduleExpansionPolicy.resolvedIDs(
                previousEventID: "event",
                eventID: "event",
                currentIDs: ["manual"],
                highlightedID: "deep-link"
            ),
            ["manual", "deep-link"]
        )
        XCTAssertEqual(
            HubEventScheduleScrollPolicy.target(
                highlightedID: "deep-link",
                lastScrolledID: nil
            ),
            "deep-link"
        )
    }

    private func makePresentation(
        _ event: HubEvent,
        highlightedID: String? = nil
    ) -> HubEventDetailCalendarPresentation {
        HubEventDetailCalendarPolicy.presentation(
            for: event,
            highlightedScheduleItemID: highlightedID,
            now: date("2026-06-02T03:00:00Z")
        )
    }

    private func event(
        startsAt: String? = nil,
        endsAt: String? = nil,
        scheduleItems: [HubEventScheduleItem] = []
    ) -> HubEvent {
        var result = HubEvent(
            id: "event",
            category: .onlineGoods,
            participationMode: .offline,
            status: .upcoming,
            title: "테스트 행사",
            summary: nil,
            memberId: nil,
            generationId: "official",
            sourceUrl: "https://example.com/source",
            sourceLabel: "공식",
            sourceType: .official,
            announcedAt: nil,
            startsAt: startsAt.map(date),
            endsAt: endsAt.map(date),
            purchaseUrl: nil,
            ticketUrl: nil,
            venueName: "테스트 장소",
            venueAddress: nil,
            notificationEligible: true,
            updatedAt: date("2026-05-01T00:00:00Z")
        )
        result.scheduleItems = scheduleItems
        return result
    }

    private func schedule(
        _ id: String,
        startsAt: String,
        endsAt: String? = nil,
        precision: HubEventTimePrecision = .datetime,
        timezone: String = "Asia/Seoul",
        cancelled: Bool = false,
        kind: HubEventScheduleKind = .custom,
        sortOrder: Int = 0
    ) -> HubEventScheduleItem {
        HubEventScheduleItem(
            id: id,
            kind: kind,
            title: nil,
            label: id,
            description: nil,
            startsAt: date(startsAt),
            endsAt: endsAt.map(date),
            timePrecision: precision,
            timezone: timezone,
            actionUrl: nil,
            sourceUrl: nil,
            sourceLabel: nil,
            notificationEligible: true,
            isPrimary: false,
            sortOrder: sortOrder,
            cancelledAt: cancelled ? date("2026-05-01T00:00:00Z") : nil
        )
    }

    private func date(_ value: String) -> Date {
        ISO8601DateFormatter().date(from: value)!
    }
}
