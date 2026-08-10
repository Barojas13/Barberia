using Barberia.Domain;
using Barberia.Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Barberia.UnitTests;

public sealed class SchedulingRulesTests : IAsyncLifetime
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private BarberiaDbContext _database = null!;
    private AvailabilityService _service = null!;

    public async Task InitializeAsync()
    {
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<BarberiaDbContext>()
            .UseSqlite(_connection)
            .Options;
        _database = new BarberiaDbContext(options);
        await _database.Database.EnsureCreatedAsync();
        _service = new AvailabilityService(_database);
    }

    public async Task DisposeAsync()
    {
        await _database.DisposeAsync();
        await _connection.DisposeAsync();
    }

    [Fact]
    public void Overlaps_WhenIntervalsTouch_ReturnsFalse()
    {
        var start = new DateTime(2030, 1, 1, 10, 0, 0, DateTimeKind.Utc);

        var overlaps = _service.Overlaps(
            start, start.AddMinutes(30), start.AddMinutes(30), start.AddMinutes(60));

        Assert.False(overlaps);
    }

    [Fact]
    public void Overlaps_WhenIntervalsIntersect_ReturnsTrue()
    {
        var start = new DateTime(2030, 1, 1, 10, 0, 0, DateTimeKind.Utc);

        var overlaps = _service.Overlaps(
            start, start.AddMinutes(30), start.AddMinutes(15), start.AddMinutes(45));

        Assert.True(overlaps);
    }

    [Fact]
    public async Task GetAvailableSlots_ExcludesBlocksAndAppointments()
    {
        var date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
        var barber = new BarberProfile { UserId = "barber-1", DisplayName = "Test Barber" };
        var customer = new CustomerProfile
        {
            UserId = "customer-1",
            Email = "customer@test.local",
            DocumentNumber = "1234567890",
            FullName = "Test Customer"
        };
        var service = new BarberService { Name = "Haircut", DurationMinutes = 30, Price = 20 };
        _database.AddRange(barber, customer, service);
        _database.Schedules.Add(new WeeklySchedule
        {
            Barber = barber,
            DayOfWeek = date.DayOfWeek,
            StartTime = new TimeOnly(9, 0),
            EndTime = new TimeOnly(11, 0)
        });
        var nine = StudioTimeZone.ToUtc(date, new TimeOnly(9, 0));
        _database.Blocks.Add(new ScheduleBlock
        {
            Barber = barber,
            StartUtc = nine.AddMinutes(30),
            EndUtc = nine.AddMinutes(60)
        });
        _database.BookingAppointments.Add(new Appointment
        {
            Barber = barber,
            Customer = customer,
            Service = service,
            StartUtc = nine.AddMinutes(90),
            EndUtc = nine.AddMinutes(120),
            Status = AppointmentStatus.Confirmed
        });
        await _database.SaveChangesAsync();

        var slots = await _service.GetAvailableSlotsAsync(barber.Id, service.Id, date);

        Assert.Contains(slots, x => x.StartUtc == nine);
        Assert.DoesNotContain(slots, x => x.StartUtc == nine.AddMinutes(30));
        Assert.DoesNotContain(slots, x => x.StartUtc == nine.AddMinutes(90));
    }

    [Fact]
    public async Task GetAvailableSlots_StepsByServiceDuration()
    {
        var date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(40));
        var barber = new BarberProfile { UserId = "barber-2", DisplayName = "Hour Barber" };
        var service = new BarberService { Name = "Corte sencillo", DurationMinutes = 60, Price = 50000 };
        _database.AddRange(barber, service);
        _database.Schedules.Add(new WeeklySchedule
        {
            Barber = barber,
            DayOfWeek = date.DayOfWeek,
            StartTime = new TimeOnly(9, 0),
            EndTime = new TimeOnly(12, 0)
        });
        await _database.SaveChangesAsync();

        var slots = await _service.GetAvailableSlotsAsync(barber.Id, service.Id, date);
        var expected = new[]
        {
            StudioTimeZone.ToUtc(date, new TimeOnly(9, 0)),
            StudioTimeZone.ToUtc(date, new TimeOnly(10, 0)),
            StudioTimeZone.ToUtc(date, new TimeOnly(11, 0)),
        };

        Assert.Equal(expected, slots.Select(x => x.StartUtc).ToArray());
        Assert.All(slots, slot => Assert.Equal(TimeSpan.FromHours(1), slot.EndUtc - slot.StartUtc));
    }

    [Fact]
    public async Task GetAvailableSlots_UsesColombiaLocalBusinessHours()
    {
        var date = new DateOnly(2030, 3, 12); // Tuesday
        var barber = new BarberProfile { UserId = "barber-3", DisplayName = "Julian" };
        var service = new BarberService { Name = "Combo", DurationMinutes = 90, Price = 75000 };
        _database.AddRange(barber, service);
        _database.Schedules.Add(new WeeklySchedule
        {
            Barber = barber,
            DayOfWeek = DayOfWeek.Tuesday,
            StartTime = new TimeOnly(8, 0),
            EndTime = new TimeOnly(17, 0)
        });
        await _database.SaveChangesAsync();

        var slots = await _service.GetAvailableSlotsAsync(barber.Id, service.Id, date);
        var firstLocal = TimeZoneInfo.ConvertTimeFromUtc(slots[0].StartUtc, StudioTimeZone.Bogota);

        Assert.Equal(new TimeOnly(8, 0), TimeOnly.FromDateTime(firstLocal));
        Assert.Equal(StudioTimeZone.ToUtc(date, new TimeOnly(8, 0)), slots[0].StartUtc);
        Assert.DoesNotContain(slots, x => x.StartUtc == DateTime.SpecifyKind(date.ToDateTime(new TimeOnly(8, 0)), DateTimeKind.Utc));
    }
}
