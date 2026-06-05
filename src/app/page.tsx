"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const modules = [
  {
    title: "Agenda de Servicos",
    description: "Registro inicial com data, cliente e observacao.",
    href: "/agenda"
  },
  {
    title: "Diario Operacional",
    description: "Registro inicial com data, tecnico, cliente, servico realizado e observacao.",
    href: "/diario"
  },
  {
    title: "Relatorios",
    description: "Base para filtros por data, tecnico e periodo.",
    href: "/relatorios"
  },
  {
    title: "Veiculos",
    description: "Controle de despesas operacionais por placa, veiculo e tipo.",
    href: "/veiculos"
  }
];

const mainCity = {
  name: "Ourinhos/SP",
  latitude: -22.9789,
  longitude: -49.8706
};

const selectableCities = [
  {
    name: "Santa Cruz do Rio Pardo/SP",
    latitude: -22.8988,
    longitude: -49.6354
  },
  {
    name: "Ribeirao do Sul/SP",
    latitude: -22.7892,
    longitude: -49.9336
  },
  {
    name: "Ipaussu/SP",
    latitude: -23.0575,
    longitude: -49.6264
  },
  {
    name: "Piraju/SP",
    latitude: -23.1936,
    longitude: -49.3839
  },
  {
    name: "Ribeirao Claro/PR",
    latitude: -23.1944,
    longitude: -49.7597
  },
  {
    name: "Jacarezinho/PR",
    latitude: -23.1601,
    longitude: -49.9694
  },
  {
    name: "Andira/PR",
    latitude: -23.0533,
    longitude: -50.2304
  },
  {
    name: "Cambara/PR",
    latitude: -23.0464,
    longitude: -50.0736
  },
  {
    name: "Salto Grande/SP",
    latitude: -22.8894,
    longitude: -49.9844
  }
];

type City = {
  name: string;
  latitude: number;
  longitude: number;
};

type ForecastDay = {
  date: string;
  min: number;
  max: number;
  rain: number;
};

type CityForecast = {
  city: string;
  current: {
    temperature: number;
    humidity: number;
    windSpeed: number;
  };
  days: ForecastDay[];
};

export default function HomePage() {
  const [selectedCityName, setSelectedCityName] = useState(selectableCities[0].name);
  const [mainForecast, setMainForecast] = useState<CityForecast | null>(null);
  const [selectedForecast, setSelectedForecast] = useState<CityForecast | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");

  const loadWeather = useCallback(async () => {
    const selectedCity = selectableCities.find((city) => city.name === selectedCityName) ?? selectableCities[0];

    setWeatherLoading(true);
    setWeatherError("");

    try {
      const [mainData, selectedData] = await Promise.all([
        fetchForecast(mainCity),
        fetchForecast(selectedCity)
      ]);

      setMainForecast(mainData);
      setSelectedForecast(selectedData);
    } catch (error) {
      setWeatherError(error instanceof Error ? error.message : "Nao foi possivel carregar o clima.");
    } finally {
      setWeatherLoading(false);
    }
  }, [selectedCityName]);

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadWeather();
    }, 30 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, [loadWeather]);

  return (
    <main className="app-shell">
      <div className="app-container">
        <header className="topbar">
          <div className="brand">
            <h1>MRL OLIMPIO IA</h1>
            <p>Gestão Operacional</p>
          </div>
          <nav className="nav" aria-label="Navegacao principal">
            {modules.map((module) => (
              <Link href={module.href} key={module.href}>
                {module.title}
              </Link>
            ))}
          </nav>
        </header>

        <section className="panel">
          <div className="module-grid">
            {modules.map((module) => (
              <article className="module" key={module.href}>
                <h2>{module.title}</h2>
                <p>{module.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel weather-panel" aria-label="Clima Operacional">
          <div className="section-heading">
            <div>
              <h2>Clima Operacional</h2>
              <p className="muted-text">Previsao de hoje e amanha via Open-Meteo.</p>
            </div>
            <label className="weather-select">
              Cidade
              <select
                value={selectedCityName}
                onChange={(event) => setSelectedCityName(event.target.value)}
              >
                {selectableCities.map((city) => (
                  <option key={city.name} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {weatherError ? <p className="error-text">{weatherError}</p> : null}
          {weatherLoading ? <p className="status-text">Carregando clima...</p> : null}

          {!weatherLoading ? (
            <div className="weather-grid">
              {mainForecast ? <WeatherCityCard forecast={mainForecast} fixed /> : null}
              {selectedForecast ? <WeatherCityCard forecast={selectedForecast} /> : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function WeatherCityCard({ forecast, fixed = false }: { forecast: CityForecast; fixed?: boolean }) {
  return (
    <article className="weather-city-card">
      <div className="weather-city-heading">
        <h3>{forecast.city}</h3>
        {fixed ? <span>Cidade principal</span> : null}
      </div>
      <div className="weather-current-grid">
        <div className="weather-current-item">
          <span>Temperatura atual</span>
          <strong>{Math.round(forecast.current.temperature)}°C</strong>
        </div>
        <div className="weather-current-item">
          <span>Umidade atual</span>
          <strong>{forecast.current.humidity}%</strong>
        </div>
        <div className="weather-current-item">
          <span>Vento</span>
          <strong>{Math.round(forecast.current.windSpeed)} km/h</strong>
        </div>
      </div>
      <div className="weather-day-grid">
        {forecast.days.map((day, index) => (
          <div className="weather-day" key={day.date}>
            <strong>{index === 0 ? "Hoje" : "Amanha"}</strong>
            <span>{day.date}</span>
            <p>
              Min {Math.round(day.min)}°C | Max {Math.round(day.max)}°C
            </p>
            <div className="rain-row">
              <span className={`traffic-light ${trafficLightClass(day.rain)}`} aria-hidden="true" />
              <span>{day.rain}% de chuva</span>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

async function fetchForecast(city: City): Promise<CityForecast> {
  const params = new URLSearchParams({
    latitude: String(city.latitude),
    longitude: String(city.longitude),
    current: "temperature_2m,relative_humidity_2m,wind_speed_10m",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "America/Sao_Paulo",
    forecast_days: "2"
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Nao foi possivel consultar a Open-Meteo.");
  }

  const data = await response.json();

  return {
    city: city.name,
    current: {
      temperature: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m
    },
    days: data.daily.time.map((date: string, index: number) => ({
      date,
      min: data.daily.temperature_2m_min[index],
      max: data.daily.temperature_2m_max[index],
      rain: data.daily.precipitation_probability_max[index] ?? 0
    }))
  };
}

function trafficLightClass(rain: number) {
  if (rain <= 30) {
    return "traffic-green";
  }

  if (rain <= 60) {
    return "traffic-yellow";
  }

  return "traffic-red";
}
