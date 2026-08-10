# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Barberia.slnx ./
COPY backend/Barberia.Domain/Barberia.Domain.csproj backend/Barberia.Domain/
COPY backend/Barberia.Application/Barberia.Application.csproj backend/Barberia.Application/
COPY backend/Barberia.Infrastructure/Barberia.Infrastructure.csproj backend/Barberia.Infrastructure/
COPY backend/Barberia.Api/Barberia.Api.csproj backend/Barberia.Api/

RUN dotnet restore backend/Barberia.Api/Barberia.Api.csproj

COPY backend/ backend/
RUN dotnet publish backend/Barberia.Api/Barberia.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Keep timezone data and CA certificates for Neon SSL connections.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /data
ENV TZ=America/Bogota
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ConnectionStrings__DefaultConnection="Data Source=/data/barberia.db"
# Render injects PORT; default to 8080 for local Docker runs.
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
EXPOSE 8080

COPY --from=build /app/publish .
CMD ["sh", "-c", "dotnet Barberia.Api.dll --urls http://0.0.0.0:${PORT:-8080}"]
