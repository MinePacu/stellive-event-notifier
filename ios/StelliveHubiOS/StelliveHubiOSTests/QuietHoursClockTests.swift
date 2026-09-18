import XCTest
@testable import StelliveHubiOS

final class QuietHoursClockTests: XCTestCase {
    private func calendar(_ identifier: Calendar.Identifier = .gregorian, timeZone: String) -> Calendar {
        var calendar = Calendar(identifier: identifier)
        calendar.timeZone = TimeZone(identifier: timeZone)!
        calendar.locale = Locale(identifier: "en_US_POSIX")
        return calendar
    }

    func testParsesValidClockStrings() {
        XCTAssertEqual(QuietHoursClock.minutes(from: "00:00"), 0)
        XCTAssertEqual(QuietHoursClock.minutes(from: "07:05"), 7 * 60 + 5)
        XCTAssertEqual(QuietHoursClock.minutes(from: "12:00"), 12 * 60)
        XCTAssertEqual(QuietHoursClock.minutes(from: "23:00"), 23 * 60)
        XCTAssertEqual(QuietHoursClock.minutes(from: "23:59"), 23 * 60 + 59)
    }

    func testRejectsMalformedClockStrings() {
        let malformed = [
            "", "9시", "9:00", "09:0", "0900", "09-00", "09:00:00", " 09:00", "09:00 ", "09:00\n",
            "24:00", "25:10", "12:60", "99:99", "aa:bb", "9:00 PM", "09:00 AM",
            "\u{0660}\u{0669}:\u{0660}\u{0660}", // Arabic-Indic digits: the server regex needs ASCII
            "\u{FF10}\u{FF19}:\u{FF10}\u{FF10}"  // full-width digits
        ]
        for value in malformed {
            XCTAssertNil(QuietHoursClock.minutes(from: value), "\(value.debugDescription) must be rejected")
            XCTAssertNil(QuietHoursClock.date(from: value), "\(value.debugDescription) must not produce a Date")
        }
    }

    func testFormatsMinutesZeroPaddedTwentyFourHour() {
        XCTAssertEqual(QuietHoursClock.string(fromMinutes: 0), "00:00")
        XCTAssertEqual(QuietHoursClock.string(fromMinutes: 5), "00:05")
        XCTAssertEqual(QuietHoursClock.string(fromMinutes: 12 * 60), "12:00")
        XCTAssertEqual(QuietHoursClock.string(fromMinutes: 23 * 60 + 59), "23:59")
    }

    func testMidnightAndEndOfDayRoundTrip() {
        let calendar = calendar(timeZone: "Asia/Seoul")
        for value in ["00:00", "00:01", "12:00", "23:59"] {
            let date = QuietHoursClock.date(from: value, calendar: calendar)
            XCTAssertNotNil(date, value)
            XCTAssertEqual(QuietHoursClock.string(from: date!, calendar: calendar), value)
        }
    }

    func testEveryMinuteOfDayRoundTripsInDSTAndNonDSTTimeZones() {
        for zone in ["Asia/Seoul", "America/New_York", "Europe/London", "Pacific/Auckland", "Asia/Kolkata", "UTC"] {
            let calendar = calendar(timeZone: zone)
            for total in 0..<(24 * 60) {
                let value = QuietHoursClock.string(fromMinutes: total)
                guard let date = QuietHoursClock.date(from: value, calendar: calendar) else {
                    XCTFail("\(value) produced no Date in \(zone)")
                    return
                }
                XCTAssertEqual(QuietHoursClock.string(from: date, calendar: calendar), value, "round trip in \(zone)")
            }
        }
    }

    func testRoundTripDoesNotDependOnCalendarSystem() {
        for identifier in [Calendar.Identifier.buddhist, .japanese, .islamicUmmAlQura, .hebrew] {
            let calendar = calendar(identifier, timeZone: "Asia/Seoul")
            let date = QuietHoursClock.date(from: "23:00", calendar: calendar)
            XCTAssertNotNil(date, "\(identifier)")
            XCTAssertEqual(date.map { QuietHoursClock.string(from: $0, calendar: calendar) }, "23:00", "\(identifier)")
        }
    }

    func testOutputIsASCIIRegardlessOfLocale() {
        var calendar = calendar(timeZone: "Asia/Seoul")
        calendar.locale = Locale(identifier: "ar_SA")
        let date = QuietHoursClock.date(from: "07:05", calendar: calendar)!
        let value = QuietHoursClock.string(from: date, calendar: calendar)
        XCTAssertEqual(value, "07:05")
        XCTAssertEqual(value.unicodeScalars.map(\.value), [0x30, 0x37, 0x3A, 0x30, 0x35])
    }

    func testStringFromDateUsesTheDatePickersHourAndMinuteOnly() {
        // A DatePicker may hand back any day; only hour/minute (in the calendar's zone) count.
        let calendar = calendar(timeZone: "Asia/Seoul")
        let components = DateComponents(year: 2030, month: 7, day: 19, hour: 6, minute: 30, second: 42)
        XCTAssertEqual(QuietHoursClock.string(from: calendar.date(from: components)!, calendar: calendar), "06:30")
    }

    func testDisplayDateFallsBackWithoutTouchingStoredValue() {
        let calendar = calendar(timeZone: "Asia/Seoul")
        var stored = QuietHoursState()
        stored.start = "9시"
        stored.end = ""

        let start = QuietHoursClock.displayDate(from: stored.start, fallback: QuietHoursClock.fallbackStart, calendar: calendar)
        let end = QuietHoursClock.displayDate(from: stored.end, fallback: QuietHoursClock.fallbackEnd, calendar: calendar)

        XCTAssertEqual(QuietHoursClock.string(from: start, calendar: calendar), QuietHoursClock.fallbackStart)
        XCTAssertEqual(QuietHoursClock.string(from: end, calendar: calendar), QuietHoursClock.fallbackEnd)
        // Display-only: the stored strings are still the malformed originals.
        XCTAssertEqual(stored.start, "9시")
        XCTAssertEqual(stored.end, "")
    }

    func testDisplayDateUsesValidStoredValue() {
        let calendar = calendar(timeZone: "Asia/Seoul")
        let date = QuietHoursClock.displayDate(from: "00:00", fallback: QuietHoursClock.fallbackStart, calendar: calendar)
        XCTAssertEqual(QuietHoursClock.string(from: date, calendar: calendar), "00:00")
    }

    func testFallbacksMatchModelDefaultsAndAreValid() {
        XCTAssertEqual(QuietHoursClock.fallbackStart, "23:00")
        XCTAssertEqual(QuietHoursClock.fallbackEnd, "08:00")
        XCTAssertNotNil(QuietHoursClock.minutes(from: QuietHoursClock.fallbackStart))
        XCTAssertNotNil(QuietHoursClock.minutes(from: QuietHoursClock.fallbackEnd))
    }

    func testTimeZoneOptionsContainStoredKnownIdentifierWithoutDuplicates() {
        let options = QuietHoursClock.timeZoneOptions(including: "Asia/Seoul")
        XCTAssertEqual(options.filter { $0 == "Asia/Seoul" }.count, 1)
        XCTAssertEqual(Set(options).count, options.count)
        XCTAssertNotEqual(options.first, "Asia/Seoul", "known identifiers keep their sorted position")
        XCTAssertEqual(options, options.sorted())
    }

    func testTimeZoneOptionsKeepUnknownStoredValueSelectable() {
        for stored in ["KST", "Mars/Olympus", ""] {
            let options = QuietHoursClock.timeZoneOptions(including: stored)
            XCTAssertEqual(options.first, stored)
            XCTAssertEqual(options.filter { $0 == stored }.count, 1)
            XCTAssertTrue(options.contains("Asia/Seoul"))
        }
    }
}
