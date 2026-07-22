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

RUN mkdir -p /data
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
ENV ConnectionStrings__DefaultConnection="Data Source=/data/barberia.db"
EXPOSE 8080

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Barberia.Api.dll"]
