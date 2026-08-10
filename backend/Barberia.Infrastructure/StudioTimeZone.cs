namespace Barberia.Infrastructure;

/// <summary>
/// Converts studio local times (Colombia) to and from UTC for scheduling.
/// Uses a fixed UTC-5 offset because Colombia does not observe daylight saving,
/// which also avoids timezone database issues in slim Docker images.
/// </summary>
public static class StudioTimeZone
{
    /// <summary>Colombia local time (UTC-5).</summary>
    public static TimeZoneInfo Bogota { get; } = TimeZoneInfo.CreateCustomTimeZone(
        "Colombia Standard Time",
        TimeSpan.FromHours(-5),
        "Hora de Colombia",
        "Hora de Colombia");

    /**
     * Converts a local studio date and time into UTC.
     * @param date Local calendar date.
     * @param time Local wall-clock time.
     */
    public static DateTime ToUtc(DateOnly date, TimeOnly time)
    {
        var local = DateTime.SpecifyKind(date.ToDateTime(time), DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(local, Bogota);
    }

    /**
     * Converts a UTC instant into the studio local calendar date.
     * @param utc Coordinated universal time.
     */
    public static DateOnly ToLocalDate(DateTime utc)
    {
        var value = DateTime.SpecifyKind(utc.ToUniversalTime(), DateTimeKind.Utc);
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(value, Bogota));
    }
}
