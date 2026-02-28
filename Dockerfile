FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY TicketDeflection/TicketDeflection.csproj TicketDeflection/
COPY TicketDeflection.Tests/TicketDeflection.Tests.csproj TicketDeflection.Tests/
RUN dotnet restore TicketDeflection/TicketDeflection.csproj
COPY . .
RUN dotnet publish TicketDeflection/TicketDeflection.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "TicketDeflection.dll"]
