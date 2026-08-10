namespace Barberia.Infrastructure;

/// <summary>
/// Converts studio local times (Colombia) to and from UTC for scheduling.
/// </summary>
public static class StudioTimeZone
{
    /// <summary>America/Bogota (UTC-5, no daylight saving).</summary>
    public static TimeZoneInfo Bogota { get; } = ResolveBogota();

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

    private static TimeZoneInfo ResolveBogota()
    {
        foreach (var id in new[] { "America/Bogota", "SA Pacific Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return TimeZoneInfo.CreateCustomTimeZone(
            "America/Bogota",
            TimeSpan.FromHours(-5),
            "Hora de Colombia",
            "Hora de Colombia");
    }
}
