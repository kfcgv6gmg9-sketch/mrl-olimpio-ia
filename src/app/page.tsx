"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { AuthGate } from "@/components/AuthGate";
import { useCurrentAccess } from "@/hooks/useCurrentAccess";
import { AppModule, canAccessModule } from "@/lib/accessControl";
import { supabase } from "@/lib/supabase";

type DashboardIndicators = {
  agendaHoje: number;
  agendaEmAndamento: number;
  agendaFinalizados: number;
  diarioHoje: number;
  diarioSemana: number;
  despesasMes: number;
};

const initialIndicators: DashboardIndicators = {
  agendaHoje: 0,
  agendaEmAndamento: 0,
  agendaFinalizados: 0,
  diarioHoje: 0,
  diarioSemana: 0,
  despesasMes: 0
};

const modules = [
  {
    id: "agenda",
    title: "Agenda de Servicos",
    description: "Registro inicial com data, cliente e observacao.",
    href: "/agenda"
  },
  {
    id: "diario",
    title: "Diario Operacional",
    description: "Registro inicial com data, tecnico, cliente, servico realizado e observacao.",
    href: "/diario"
  },
  {
    id: "relatorios",
    title: "Relatorios",
    description: "Base para filtros por data, tecnico e periodo.",
    href: "/relatorios"
  },
  {
    id: "veiculos",
    title: "Veiculos",
    description: "Controle de despesas operacionais por placa, veiculo e tipo.",
    href: "/veiculos"
  },
  {
    id: "usuarios",
    title: "Administracao > Usuarios",
    description: "Gestao de usuarios, perfis e status de acesso.",
    href: "/administracao/usuarios"
  },
  {
    id: "auditoria",
    title: "Administracao > Auditoria",
    description: "Historico de alteracoes por usuario, modulo e periodo.",
    href: "/administracao/auditoria"
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
  return (
    <main className="app-shell">
      <div className="app-container">
        <AuthGate>
          <HomeDashboard />
        </AuthGate>
      </div>
    </main>
  );
}

function HomeDashboard() {
  const { email, metadata } = useCurrentAccess();
  const [indicators, setIndicators] = useState<DashboardIndicators>(initialIndicators);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [selectedCityName, setSelectedCityName] = useState(selectableCities[0].name);
  const [mainForecast, setMainForecast] = useState<CityForecast | null>(null);
  const [selectedForecast, setSelectedForecast] = useState<CityForecast | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const visibleModules = modules.filter((module) => canAccessModule(email, metadata, module.id as AppModule));

  const loadDashboard = useCallback(async () => {
    const today = formatDate(new Date());
    const { weekStart, weekEnd } = currentWeekRange();
    const { monthStart, monthEnd } = currentMonthRange();

    setDashboardLoading(true);
    setDashboardError("");

    try {
      const [
        agendaHojeResponse,
        agendaEmAndamentoResponse,
        agendaFinalizadosResponse,
        diarioHojeResponse,
        diarioSemanaResponse,
        despesasMes
      ] = await Promise.all([
        supabase
          .from("agenda_servicos")
          .select("id", { count: "exact", head: true })
          .eq("data", today)
          .neq("status_agendamento", "Cancelado"),
        supabase
          .from("agenda_servicos")
          .select("id", { count: "exact", head: true })
          .neq("status_agendamento", "Cancelado")
          .or("bloqueado.is.false,bloqueado.is.null"),
        supabase
          .from("agenda_servicos")
          .select("id", { count: "exact", head: true })
          .eq("bloqueado", true),
        supabase
          .from("diario_operacional")
          .select("id", { count: "exact", head: true })
          .eq("data", today),
        supabase
          .from("diario_operacional")
          .select("id", { count: "exact", head: true })
          .gte("data", weekStart)
          .lte("data", weekEnd),
        sumDespesasMes(monthStart, monthEnd)
      ]);

      const errors = [
        agendaHojeResponse.error,
        agendaEmAndamentoResponse.error,
        agendaFinalizadosResponse.error,
        diarioHojeResponse.error,
        diarioSemanaResponse.error
      ].filter(Boolean);

      if (errors.length > 0) {
        setDashboardError(errors[0]?.message ?? "Nao foi possivel carregar os indicadores.");
      } else {
        setIndicators({
          agendaHoje: agendaHojeResponse.count ?? 0,
          agendaEmAndamento: agendaEmAndamentoResponse.count ?? 0,
          agendaFinalizados: agendaFinalizadosResponse.count ?? 0,
          diarioHoje: diarioHojeResponse.count ?? 0,
          diarioSemana: diarioSemanaResponse.count ?? 0,
          despesasMes
        });
      }
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Nao foi possivel carregar os indicadores.");
    } finally {
      setDashboardLoading(false);
    }
  }, []);

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
    loadDashboard();
  }, [loadDashboard]);

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
    <>
      <header className="topbar">
        <div className="brand">
          <h1>MRL Gestao</h1>
          <p>Gestao Operacional</p>
        </div>
        <AppNav />
      </header>

      <section className="panel dashboard-panel" aria-label="Dashboard inicial">
        <div className="section-heading">
          <h2>Indicadores</h2>
          <button className="secondary-button" onClick={loadDashboard} type="button">
            Atualizar
          </button>
        </div>

        {dashboardError ? <p className="error-text">{dashboardError}</p> : null}
        {dashboardLoading ? <p className="status-text">Carregando indicadores...</p> : null}

        <div className="dashboard-grid">
          <DashboardCard label="Agenda" title="Agendados hoje" value={indicators.agendaHoje} />
          <DashboardCard label="Agenda" title="Em andamento" value={indicators.agendaEmAndamento} />
          <DashboardCard label="Agenda" title="Finalizados" value={indicators.agendaFinalizados} />
          <DashboardCard label="Diario" title="Atendimentos hoje" value={indicators.diarioHoje} />
          <DashboardCard label="Diario" title="Atendimentos da semana" value={indicators.diarioSemana} />
          <DashboardCard label="Veiculos" title="Despesas do mes" value={formatCurrency(indicators.despesasMes)} />
        </div>
      </section>

      <section className="panel">
        <div className="module-grid">
          {visibleModules.map((module) => (
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
    </>
  );
}

function DashboardCard({ label, title, value }: { label: string; title: string; value: number | string }) {
  return (
    <article className="dashboard-card">
      <span>{label}</span>
      <h2>{title}</h2>
      <strong>{value}</strong>
    </article>
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
          <strong>{Math.round(forecast.current.temperature)} C</strong>
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
              Min {Math.round(day.min)} C | Max {Math.round(day.max)} C
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

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function currentWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    weekStart: formatDate(monday),
    weekEnd: formatDate(sunday)
  };
}

function currentMonthRange() {
  const today = new Date();

  return {
    monthStart: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    monthEnd: formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0))
  };
}

async function sumDespesasMes(monthStart: string, monthEnd: string) {
  const { data, error } = await supabase
    .from("despesas_veiculos")
    .select("valor")
    .gte("data", monthStart)
    .lte("data", monthEnd);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce((total, record) => total + Number(record.valor ?? 0), 0);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}
