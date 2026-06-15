"use client";

import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { AuthGate } from "@/components/AuthGate";
import { Logo } from "@/components/Logo";
import { useCurrentAccess } from "@/hooks/useCurrentAccess";
import { AppModule, canAccessModule } from "@/lib/accessControl";
import { supabase } from "@/lib/supabase";
import { DiarioAjudante, DiarioOperacional, Funcionario } from "@/types/database";

type DashboardIndicators = {
  clientes: number;
  servicosInternos: number;
  abertos: number;
  emAndamento: number;
  aguardandoCliente: number;
  aguardandoPeca: number;
  finalizadosMes: number;
  cancelados: number;
};

const initialIndicators: DashboardIndicators = {
  clientes: 0,
  servicosInternos: 0,
  abertos: 0,
  emAndamento: 0,
  aguardandoCliente: 0,
  aguardandoPeca: 0,
  finalizadosMes: 0,
  cancelados: 0
};

type DashboardPeriod = "today" | "week" | "month";

type TechnicianIndicator = {
  tecnico: string;
  principal: number;
  ajudante: number;
  total: number;
};

type RecentAttendance = {
  id: string;
  data: string;
  cliente: string;
  tecnico: string;
  status: string;
  cidade: string;
};

const dashboardPeriodLabels: Record<DashboardPeriod, string> = {
  today: "Hoje",
  week: "Semana",
  month: "Mês"
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
  const [technicianIndicators, setTechnicianIndicators] = useState<TechnicianIndicator[]>([]);
  const [recentAttendances, setRecentAttendances] = useState<RecentAttendance[]>([]);
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>("today");
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [selectedCityName, setSelectedCityName] = useState(selectableCities[0].name);
  const [mainForecast, setMainForecast] = useState<CityForecast | null>(null);
  const [selectedForecast, setSelectedForecast] = useState<CityForecast | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const visibleModules = modules.filter((module) => canAccessModule(email, metadata, module.id as AppModule));

  const loadDashboard = useCallback(async () => {
    const { periodStart, periodEnd } = dashboardPeriodRange(dashboardPeriod);
    const { monthStart, monthEnd } = currentMonthRange();

    setDashboardLoading(true);
    setDashboardError("");

    try {
      const [
        atendimentosResponse,
        finalizadosMesResponse,
        ajudantesResponse,
        funcionariosResponse
      ] = await Promise.all([
        supabase
          .from("diario_operacional")
          .select("*")
          .gte("data", periodStart)
          .lte("data", periodEnd)
          .order("data", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("diario_operacional")
          .select("*")
          .eq("status_atendimento", "Finalizado")
          .gte("data", monthStart)
          .lte("data", monthEnd),
        supabase
          .from("diario_ajudantes")
          .select("*"),
        supabase
          .from("funcionarios")
          .select("*")
          .eq("ativo", true)
          .order("nome", { ascending: true })
      ]);

      const errors = [
        atendimentosResponse.error,
        finalizadosMesResponse.error,
        ajudantesResponse.error,
        funcionariosResponse.error
      ].filter(Boolean);

      if (errors.length > 0) {
        setDashboardError(errors[0]?.message ?? "Nao foi possivel carregar os indicadores.");
      } else {
        const attendances = (atendimentosResponse.data ?? []) as DiarioOperacional[];
        const monthFinished = (finalizadosMesResponse.data ?? []) as DiarioOperacional[];
        const helpers = (ajudantesResponse.data ?? []) as DiarioAjudante[];
        const funcionarios = (funcionariosResponse.data ?? []) as Funcionario[];

        setIndicators({
          clientes: countByType(attendances, "Cliente"),
          servicosInternos: countByType(attendances, "Serviço interno"),
          abertos: countByStatus(attendances, "Aberto"),
          emAndamento: countByStatus(attendances, "Em andamento"),
          aguardandoCliente: countByStatus(attendances, "Aguardando Cliente"),
          aguardandoPeca: countByStatus(attendances, "Aguardando Peça"),
          finalizadosMes: monthFinished.length,
          cancelados: countByStatus(attendances, "Cancelado")
        });
        setTechnicianIndicators(buildTechnicianIndicators(attendances, helpers, funcionarios));
        setRecentAttendances(
          attendances.slice(0, 10).map((attendance) => ({
            id: attendance.id,
            data: attendance.data,
            cliente: attendance.cliente,
            tecnico: attendance.tecnico,
            status: attendance.status_atendimento ?? "Aberto",
            cidade: attendance.cidade ?? "Nao informado"
          }))
        );
      }
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Nao foi possivel carregar os indicadores.");
    } finally {
      setDashboardLoading(false);
    }
  }, [dashboardPeriod]);

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
          <Logo />
          <h1>MRL Gestao</h1>
          <p>Gestao Operacional</p>
        </div>
        <AppNav />
      </header>

      <section className="panel dashboard-panel" aria-label="Dashboard inicial">
        <div className="section-heading">
          <div>
            <h2>Dashboard Operacional</h2>
            <p className="muted-text">Indicadores da assistencia tecnica em tempo real.</p>
          </div>
          <div className="button-row">
            {Object.entries(dashboardPeriodLabels).map(([period, label]) => (
              <button
                className={dashboardPeriod === period ? "primary-button" : "secondary-button"}
                key={period}
                onClick={() => setDashboardPeriod(period as DashboardPeriod)}
                type="button"
              >
                {label}
              </button>
            ))}
            <button className="secondary-button" onClick={loadDashboard} type="button">
              Atualizar
            </button>
          </div>
        </div>

        {dashboardError ? <p className="error-text">{dashboardError}</p> : null}
        {dashboardLoading ? <p className="status-text">Carregando indicadores...</p> : null}

        <div className="dashboard-grid">
          <DashboardCard label="Diario" title="Atendimentos de Clientes" value={indicators.clientes} />
          <DashboardCard label="Diario" title="Serviços Internos" value={indicators.servicosInternos} />
          <DashboardCard label="Diario" title="Atendimentos Abertos" value={indicators.abertos} />
          <DashboardCard label="Diario" title="Em Andamento" value={indicators.emAndamento} />
          <DashboardCard label="Diario" title="Aguardando Cliente" value={indicators.aguardandoCliente} />
          <DashboardCard label="Diario" title="Aguardando Peça" value={indicators.aguardandoPeca} />
          <DashboardCard label="Diario" title="Finalizados no mês" value={indicators.finalizadosMes} />
          <DashboardCard label="Diario" title="Cancelados" value={indicators.cancelados} />
        </div>

        <div className="dashboard-detail-grid">
          <section className="dashboard-subsection" aria-label="Indicadores por tecnico finalizados">
            <h3>Indicadores por Técnico (Finalizados)</h3>
            <div className="dashboard-table-wrap">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Técnico</th>
                    <th>Principal</th>
                    <th>Ajudante</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {technicianIndicators.map((indicator) => (
                    <tr key={indicator.tecnico}>
                      <td>{indicator.tecnico}</td>
                      <td>{indicator.principal}</td>
                      <td>{indicator.ajudante}</td>
                      <td>{indicator.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="dashboard-subsection" aria-label="Ultimos atendimentos">
            <h3>Últimos 10 atendimentos</h3>
            <div className="record-list">
              {recentAttendances.length === 0 && !dashboardLoading ? (
                <p className="status-text">Nenhum atendimento encontrado.</p>
              ) : null}
              {recentAttendances.map((attendance) => (
                <article className="record-card compact-record-card" key={attendance.id}>
                  <div>
                    <strong>{attendance.cliente}</strong>
                    <span>Data: {attendance.data}</span>
                    <span>Técnico principal: {attendance.tecnico}</span>
                    <span>Status: {attendance.status}</span>
                    <span>Cidade: {attendance.cidade}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
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

function countByStatus(records: DiarioOperacional[], status: string) {
  return records.filter((record) => record.status_atendimento === status).length;
}

function countByType(records: DiarioOperacional[], type: string) {
  return records.filter((record) => diarioTipoAtendimento(record) === type).length;
}

function normalizeTipoAtendimento(value?: string | null) {
  return value === "Serviço interno" ? "Serviço interno" : "Cliente";
}

function diarioTipoAtendimento(record: Pick<DiarioOperacional, "tipo_atendimento" | "cliente">) {
  if (record.tipo_atendimento) {
    return normalizeTipoAtendimento(record.tipo_atendimento);
  }

  return record.cliente === "Cobop / Interno" ? "Serviço interno" : "Cliente";
}

function buildTechnicianIndicators(
  attendances: DiarioOperacional[],
  helpers: DiarioAjudante[],
  funcionarios: Funcionario[]
) {
  const finishedAttendances = attendances.filter((attendance) => attendance.status_atendimento === "Finalizado");
  const attendancesById = new Map(finishedAttendances.map((attendance) => [attendance.id, attendance]));
  const funcionarioName = (funcionarioId: string) =>
    funcionarios.find((funcionario) => funcionario.id === funcionarioId)?.nome ?? funcionarioId;

  return funcionarios.map((funcionario) => {
    const tecnico = funcionario.nome;
    const principal = finishedAttendances.filter((attendance) => sameName(attendance.tecnico, tecnico)).length;
    const ajudante = helpers.filter((helper) => {
      const attendance = attendancesById.get(helper.diario_id);

      return Boolean(attendance) && sameName(funcionarioName(helper.funcionario_id), tecnico);
    }).length;

    return {
      tecnico,
      principal,
      ajudante,
      total: principal + ajudante
    };
  });
}

function sameName(first: string, second: string) {
  return first.trim().toLowerCase() === second.trim().toLowerCase();
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

function dashboardPeriodRange(period: DashboardPeriod) {
  if (period === "today") {
    const today = formatDate(new Date());

    return {
      periodStart: today,
      periodEnd: today
    };
  }

  if (period === "week") {
    const { weekStart, weekEnd } = currentWeekRange();

    return {
      periodStart: weekStart,
      periodEnd: weekEnd
    };
  }

  const { monthStart, monthEnd } = currentMonthRange();

  return {
    periodStart: monthStart,
    periodEnd: monthEnd
  };
}
