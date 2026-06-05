# Notification Load Reduction Policy

This document defines the planned policy for reducing notification noise and push load.
It is both a product policy and an engineering reference for future Android, iOS, and backend implementation.

All notification reduction behavior must preserve the existing notification policy:
- Global off blocks every notification.
- User preferences, quiet hours, keyword rules, and rate limits remain authoritative.
- `realtime_best_effort` may change delivery strategy only after an event is allowed.
- Official YouTube live scheduled/started/ended notifications remain unsupported.

## Common Policy

Events are divided into three delivery levels:
- `immediate_push`: send a push notification immediately.
- `summary_push`: include the event in a grouped summary notification.
- `in_app_history_only`: store the event in app-visible history without sending a push notification.

The backend may downgrade events to a lower delivery level during notification spikes.

Spike downgrade behavior must support:
- A server-side on/off control.
- Automatic operation based on server-side policy.
- Continued enforcement of user preferences, quiet hours, keyword rules, and rate limits.

## Android Policy

Android notification channels must be split by notification category so users can reduce noise from Android system settings.

Android channel design should support:
- Separate channels for meaningfully different notification categories.
- Channel groups that make related notification controls easier to manage.
- Grouping notifications with the same topic.
- Updating an existing notification when the same topic receives new events.
- Showing the two most recent notification contents when an existing notification is updated.
- Requesting notification permission at a moment when the user can understand why notifications are useful, instead of immediately on first launch.

## iOS Policy

iOS notifications with the same topic or flow must use `threadIdentifier` where applicable.

iOS notification delivery should support:
- Collapse behavior for notifications that can be replaced by a newer state.
- Higher-quality summary text and prioritization for grouped notifications.
- Removing delivered notifications that are no longer meaningful, such as notifications replaced by newer state or invalidated by cancellation.

## Future Consideration

If push volume exceeds operating expectations, add a maximum push cap per 10 minutes.
When the cap is exceeded, replace additional individual pushes with a summary push.
