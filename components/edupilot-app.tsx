"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ThemeProvider } from "./theme-provider";
import { useForm } from "react-hook-form";
import { Toaster, toast } from "sonner";
import {
  Sparkles,
  ArrowUpRight,
  ArrowRight,
  Plus,
  MessageSquare,
  BookOpen,
  FileText,
  ClipboardCheck,
  Presentation,
  Clapperboard,
  FolderOpen,
  Users,
  Settings,
  LifeBuoy,
  LogOut,
  Sun,
  Menu,
  X,
  Orbit,
  ChevronRight,
  GraduationCap,
  PanelLeftClose,
  Check,
  SlidersHorizontal,
  Activity,
} from "lucide-react";
import { api } from "@/lib/client";
import { toolNames, ToolType, subjects } from "@/lib/domain";
import { AppContext, useApp } from "./app-context";
import { ConstellationBackground } from "./constellation/background";
import {
  defaultBackground,
  BackgroundSettings,
} from "./constellation/particle-engine";
import {
  GlassCard,
  GradientButton,
  AnimatedPage,
  EmptyState,
  Field,
} from "./ui/edupilot";
import { ChatComposer } from "./workspace/composer";
const ChatPage = dynamic(() =>
  import("./workspace/chat").then((m) => m.ChatPage),
);
const ToolPage = dynamic(() =>
  import("./workspace/materials").then((m) => m.ToolPage),
);
const MaterialEditor = dynamic(() =>
  import("./workspace/materials").then((m) => m.MaterialEditor),
);
const MaterialsPage = dynamic(() =>
  import("./workspace/materials").then((m) => m.MaterialsPage),
);
const QuizPage = dynamic(() =>
  import("./workspace/materials").then((m) => m.QuizPage),
);
const ClassesPage = dynamic(() =>
  import("./workspace/classes").then((m) => m.ClassesPage),
);
const LearningPage = dynamic(() =>
  import("./learning").then((m) => m.LearningPage),
);
const tools: {
  type: ToolType;
  icon: any;
  description: string;
  color: string;
}[] = [
  {
    type: "review",
    icon: ClipboardCheck,
    description: "Внимание к каждой работе",
    color: "mint",
  },
  {
    type: "lesson",
    icon: BookOpen,
    description: "От идеи до готового занятия",
    color: "mint",
  },
  {
    type: "worksheet",
    icon: FileText,
    description: "Задания, которые увлекают",
    color: "violet",
  },
  {
    type: "test",
    icon: ClipboardCheck,
    description: "Проверяйте знания по-новому",
    color: "rose",
  },
  {
    type: "presentation",
    icon: Presentation,
    description: "Сложное становится наглядным",
    color: "amber",
  },
  {
    type: "video",
    icon: Clapperboard,
    description: "Сценарий вашего видеоурока",
    color: "blue",
  },
];
const visibleTools = tools.filter((tool) => tool.type !== "video");
export function EduPilot() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const path = pathname;
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [background, setBackground] =
    useState<BackgroundSettings>(defaultBackground);
  const [bgOpen, setBgOpen] = useState(false);
  const [view, setView] = useState("teacher");
  const refresh = async () => {
    try {
      const data = await api("session");
      setSession(data);
      if (data.user) {
        setView(data.user.role);
        setBackground({
          ...defaultBackground,
          ...data.user.settings?.preferences?.background,
        });
        document.documentElement.dataset.theme =
          data.user.settings?.theme || "dark";
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    setMenu(false);
  }, [path]);
  const navigate = (to: string) => {
    if(!window.dispatchEvent(new Event('edupilot:navigate',{cancelable:true}))) return;
    router.push(to);
  };
  const savePreferences = async (patch: any) => {
    await api("settings", "PATCH", {
      preferences: { ...session.user.settings?.preferences, ...patch },
    });
    await refresh();
  };
  const theme = async () => {
    const next =
      document.documentElement.dataset.theme === "light" ? "dark" : "light";
    await api("settings", "PATCH", { theme: next });
    await refresh();
  };
  const logout = async () => {
    try {
      await api("auth/logout", "POST", {});
      setSession({ user: null, ai: session.ai });
      router.push("/");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  let content;
  if (!session?.user) {
    content =
      path === "/login" || path === "/register" ? (
        <AuthPage register={path === "/register"} />
      ) : (
        <Landing />
      );
  } else if (path === "/" || path === "/workspace")
    content = <Dashboard view={view} onBackground={() => setBgOpen(!bgOpen)} />;
  else if (path.startsWith("/tools/"))
    content = <ToolPage type={path.split("/")[2] as ToolType} />;
  else if (path === "/materials") content = <MaterialsPage />;
  else if (path.startsWith("/materials/"))
    content = <MaterialEditor id={path.split("/")[2]} />;
  else if (path.startsWith("/quiz/"))
    content = <QuizPage id={path.split("/")[2]} />;
  else if (path.startsWith("/chat"))
    content = <ChatPage id={path.split("/")[2]} />;
  else if (path.startsWith("/classes"))
    content = <ClassesPage id={path.split("/")[2]} />;
  else if (path === "/learning" || path.startsWith("/learning/"))
    content = <LearningPage key={path} section={path.split("/")[2]} />;
  else if (path === "/settings")
    content = (
      <SettingsPage
        background={background}
        setBackground={setBackground}
        saveBackground={async (b: BackgroundSettings) =>
          savePreferences({ background: b })
        }
      />
    );
  else if (path === "/help") content = <HelpPage />;
  else
    content = (
      <EmptyState
        icon={<Orbit />}
        title="Здесь пока пусто"
        description="Перейдите в рабочее пространство."
        action={
          <button className="button" onClick={() => navigate("/workspace")}>
            На главную
          </button>
        }
      />
    );
  return (
    <AppContext.Provider
      value={{ user: session?.user, ai: session?.ai, refresh, navigate }}
    >
      <ThemeProvider theme={session?.user?.settings?.theme || "dark"}>
        <ConstellationBackground settings={background} />
        <Toaster richColors position="top-center" theme="dark" />
        {loading ? (
          <div className="boot">
            <Orbit className="spin" />
            <span>Открываем пространство знаний…</span>
          </div>
        ) : session?.user ? (
          <div className={`workspace ${collapsed ? "collapsed" : ""}`}>
            <GlassSidebar
              path={path}
              open={menu}
              collapsed={collapsed}
              view={view}
              onCollapse={() => setCollapsed(!collapsed)}
              logout={logout}
              theme={theme}
            />
            {menu && (
              <button
                className="sidebar-scrim"
                aria-label="Закрыть меню"
                onClick={() => setMenu(false)}
              />
            )}
            <main className="workspace-main">
              <header className="topbar">
                <div className="topbar-left">
                  <button
                    className="icon-button mobile-menu"
                    aria-label="Открыть меню"
                    onClick={() => setMenu(!menu)}
                  >
                    <Menu size={20} />
                  </button>
                  <span>Рабочее пространство</span>
                  <ChevronRight size={14} />
                  <b>
                    {path.includes("tools")
                      ? toolNames[path.split("/")[2] as ToolType] ||
                        "Инструменты"
                      : path.includes("chat")
                        ? "Ассистент"
                        : path.includes("classes")
                          ? "Классы"
                          : path.includes("settings")
                            ? "Настройки"
                            : path.includes("materials")
                              ? "Материалы"
                              : "Главная"}
                  </b>
                </div>
                <div className="topbar-right">
                  <span className="mode-badge">
                    <i />
                    {session.ai?.mode === "live"
                      ? "AI настроен"
                      : "Демо-режим ИИ"}
                  </span>
                  <button
                    className="avatar"
                    aria-label="Профиль"
                    onClick={() => navigate("/settings")}
                  >
                    {session.user.firstName[0]}
                    {session.user.lastName[0]}
                  </button>
                </div>
              </header>
              <div className="page-content" key={path}>
                {content}
              </div>
            </main>
            {bgOpen && (
              <div className="floating-settings">
                <ConstellationSettings
                  value={background}
                  onChange={setBackground}
                  onSave={async () => {
                    try {
                      await savePreferences({ background });
                      toast.success("Настройки фона сохранены");
                      setBgOpen(false);
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                />
                <button
                  className="icon-button close-settings"
                  aria-label="Закрыть настройки"
                  onClick={() => setBgOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="public-site">{content}</div>
        )}
      </ThemeProvider>
    </AppContext.Provider>
  );
}
function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Orbit size={26} strokeWidth={1.6} />
      </span>
      <strong>
        Edu<span>Pilot</span>
      </strong>
    </span>
  );
}
export function GlassSidebar({
  path,
  open,
  collapsed,
  view,
  onCollapse,
  logout,
  theme,
}: any) {
  const { user, ai, navigate } = useApp();
  const links = [
    { path: "/chat", label: "Новый чат", icon: Plus },
    ...(view === "teacher"
      ? visibleTools.map((x) => ({
          path: "/tools/" + x.type,
          label:
            x.type === "review"
              ? "Проверить работу"
              : "Создать " +
                (
                  {
                    lesson: "план урока",
                    worksheet: "рабочий лист",
                    test: "контрольную",
                    presentation: "презентацию",
                    video: "видеоурок",
                  } as any
                )[x.type],
          icon: x.icon,
        }))
      : [
          {
            path: "/chat?prompt=Объясни тему",
            label: "Объяснить тему",
            icon: BookOpen,
          },
          {
            path: "/chat?prompt=Помоги с домашним заданием",
            label: "Домашнее задание",
            icon: FileText,
          },
          {
            path: "/chat?prompt=Подготовка к ОГЭ и ЕГЭ",
            label: "Подготовка к экзаменам",
            icon: GraduationCap,
          },
          { path: "/tools/notes", label: "Создать конспект", icon: BookOpen },
          {
            path: "/materials",
            label: "Проверить знания",
            icon: ClipboardCheck,
          },
        ]),
    { path: "/materials", label: "Мои материалы", icon: FolderOpen },
    { path: "/learning", label: "Учебная траектория", icon: GraduationCap },
    { path: "/learning/progress", label: "Мой прогресс", icon: Activity },
    ...(user.role === "teacher" ? [
      { path: "/learning/analytics", label: "Аналитика обучения", icon: SlidersHorizontal },
      { path: "/learning/library", label: "Библиотека заданий", icon: BookOpen },
    ] : []),
    {
      path: "/classes",
      label: view === "teacher" ? "Мои классы" : "Мои занятия",
      icon: Users,
    },
    { path: "/chat/history", label: "История чатов", icon: MessageSquare },
  ];
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-brand">
        <button
          className="brand-button"
          onClick={() => navigate("/workspace")}
          aria-label="Главная EduPilot"
        >
          <Brand />
        </button>
        <button
          className="icon-button collapse-button"
          onClick={onCollapse}
          aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
        >
          <PanelLeftClose size={16} />
        </button>
      </div>
      <div className="role-switch" aria-label="Роль аккаунта">
        <div className="role-display">
          {view === "teacher" ? (
            <BookOpen size={14} />
          ) : (
            <GraduationCap size={16} />
          )}
          <span>{view === "teacher" ? "Учитель" : "Ученик"}</span>
        </div>
      </div>
      <button
        className={`nav-link home-link ${path === "/workspace" || path === "/" ? "active" : ""}`}
        onClick={() => navigate("/workspace")}
      >
        <Orbit size={18} />
        <span>Обзор пространства</span>
      </button>
      <p className="nav-caption">ИНСТРУМЕНТЫ</p>
      <nav>
        {links.map((l, i) => (
          <button
            title={l.label}
            key={i}
            className={`nav-link ${path === l.path || (path.startsWith(l.path + "/") && l.path !== "/chat" && l.path !== "/learning") ? "active" : ""} ${i === 0 ? "new-chat" : ""}`}
            onClick={() => navigate(l.path)}
          >
            <l.icon size={18} strokeWidth={1.6} />
            <span>{l.label}</span>
            {i === 0 && <kbd>↵</kbd>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button className="nav-link" onClick={() => navigate("/settings")}>
          <Settings size={18} />
          <span>Настройки</span>
        </button>
        <button className="nav-link" onClick={() => navigate("/help")}>
          <LifeBuoy size={18} />
          <span>Помощь и возможности</span>
        </button>
        <div className="account">
          <button
            className="account-person"
            onClick={() => navigate("/settings")}
          >
            <span className="avatar">
              {user.firstName[0]}
              {user.lastName[0]}
            </span>
            <span>
              <b>
                {user.firstName} {user.lastName}
              </b>
              <small>
                {user.role === "teacher" ? "Преподаватель" : "Ученик"} ·{" "}
                {ai?.mode === "live" ? "Live AI" : "Демо AI"}
              </small>
            </span>
          </button>
          <button
            className="icon-button"
            title="Переключить тему"
            onClick={() => theme().catch((e: any) => toast.error(e.message))}
          >
            <Sun size={17} />
          </button>
          <button className="icon-button" title="Выйти" onClick={logout}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
export function DashboardHeader({ name }: { name: string }) {
  return (
    <div className="dashboard-heading">
      <span className="eyebrow">
        <span className="tiny-star">✦</span> ВАШЕ ПРОСТРАНСТВО ЗНАНИЙ
      </span>
      <h1>
        Открывайте новые
        <br />
        возможности <em>обучения</em>
      </h1>
      <p>
        Создавайте материалы, планируйте занятия и работайте
        <br className="desktop-break" /> с искусственным интеллектом в едином
        пространстве.
      </p>
      <span className="welcome">
        Рады видеть вас, {name} <span>✧</span>
      </span>
    </div>
  );
}
function Dashboard({
  view,
  onBackground,
}: {
  view: string;
  onBackground: () => void;
}) {
  const { user, navigate } = useApp();
  const [recent, setRecent] = useState<any[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api("materials")
      .then(setRecent)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <AnimatedPage>
      <section className="dashboard-hero">
        <div className="hero-orbit" aria-hidden="true">
          <div />
          <div />
          <div />
          <span>✦</span>
        </div>
        <DashboardHeader name={user.firstName} />
        <ChatComposer dashboard />
        <div className="prompt-chips">
          {[
            "Идея для интересного урока",
            "Объясни простыми словами",
            "Помоги составить задания",
          ].map((text) => (
            <button
              key={text}
              onClick={() =>
                navigate("/chat?prompt=" + encodeURIComponent(text))
              }
            >
              <Sparkles size={12} />
              {text}
            </button>
          ))}
        </div>
      </section>
      <section className="tools-section">
        <div className="section-heading">
          <div>
            <h2>От идеи — к готовому материалу</h2>
            <p>
              {view === "teacher"
                ? "Больше времени на главное. Остальное — вашим инструментам."
                : "Ваши инструменты для новых открытий."}
            </p>
          </div>
          <span className="section-count">
            {view === "teacher" ? "05" : "04"} ИНСТРУМЕНТОВ
          </span>
        </div>
        <div className="tool-grid">
          {(view === "teacher"
            ? visibleTools
            : [
                {
                  type: "notes" as ToolType,
                  icon: BookOpen,
                  description: "Главное — на одной странице",
                  color: "mint",
                },
                ...visibleTools.filter((x) =>
                  ["worksheet", "test", "presentation"].includes(x.type),
                ),
              ]
          ).map((t) => (
            <ToolCard key={t.type} {...t} />
          ))}
        </div>
      </section>
      <section className="recent-section">
        <div className="section-heading">
          <div>
            <h2>Недавние материалы</h2>
            <p>Все ваши идеи сохраняются здесь.</p>
          </div>
          <button
            className="text-button"
            onClick={() => navigate("/materials")}
          >
            Все материалы <ArrowUpRight size={15} />
          </button>
        </div>
        {error ? (
          <p role="alert">{error}</p>
        ) : recent.length ? (
          <div className="recent-grid">
            {recent.slice(0, 3).map((m) => (
              <GlassCard key={m.id} className="recent-card">
                <span className="file-icon">
                  <FileText size={22} />
                </span>
                <button onClick={() => navigate("/materials/" + m.id)}>
                  <strong>{m.title}</strong>
                  <small>
                    {toolNames[m.type as ToolType]} · {m.grade} класс
                  </small>
                  <time>
                    {new Date(m.updatedAt).toLocaleDateString("ru-RU")}
                  </time>
                </button>
                <ChevronRight size={17} />
              </GlassCard>
            ))}
          </div>
        ) : (
          <GlassCard className="empty-recent">
            <span className="empty-folder">
              <FolderOpen size={28} />
            </span>
            <div>
              <h3>Первое открытие начинается с идеи</h3>
              <p>Создайте материал — и он появится в вашем пространстве.</p>
            </div>
            <button
              className="button secondary"
              onClick={() => navigate("/tools/lesson")}
            >
              Создать материал <Plus size={15} />
            </button>
          </GlassCard>
        )}
      </section>
      <footer className="workspace-footer">
        <span>✦ Маленькие идеи. Большие открытия.</span>
        <button className="text-button" onClick={onBackground}>
          <SlidersHorizontal size={14} /> Параметры фона
        </button>
      </footer>
    </AnimatedPage>
  );
}
export function ToolCard({ type, icon: Icon, description, color }: any) {
  const { navigate } = useApp();
  return (
    <button
      className={`tool-card ${color}`}
      onClick={() => navigate("/tools/" + type)}
    >
      <span className="tool-icon">
        <Icon size={22} strokeWidth={1.6} />
      </span>
      <ArrowUpRight className="tool-arrow" size={17} />
      <h3>
        {type === "review" ? "Проверить работу" : toolNames[type as ToolType]}
      </h3>
      <p>{description}</p>
      <span className="tool-card-line" />
    </button>
  );
}
function Landing() {
  const { navigate } = useApp();
  return (
    <>
      <header className="landing-nav">
        <Brand />
        <nav>
          <a href="#possibilities">Возможности</a>
          <a href="#instruments">Инструменты</a>
          <button className="text-button" onClick={() => navigate("/login")}>
            Войти
          </button>
          <GradientButton onClick={() => navigate("/register")}>
            Регистрация <ArrowUpRight size={15} />
          </GradientButton>
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="eyebrow">
              <i /> ОБРАЗОВАНИЕ. В НОВОЙ ОРБИТЕ.
            </span>
            <h1>
              У каждой идеи
              <br />
              есть своё
              <br />
              <em>созвездие.</em>
            </h1>
            <p>
              EduPilot объединяет ваши знания, учебные материалы и искусственный
              интеллект. Создавайте больше. Учитесь с интересом.
            </p>
            <GradientButton onClick={() => navigate("/register")}>
              Начать бесплатно <ArrowUpRight size={18} />
            </GradientButton>
            <span className="landing-note">
              Для учителей и учеников · Без API-ключа для начала
            </span>
          </div>
          <div className="constellation-art" aria-hidden="true">
            <div className="orbit-ring one" />
            <div className="orbit-ring two" />
            <div className="orbit-ring three" />
            <svg viewBox="0 0 560 560">
              <defs>
                <radialGradient id="star-glow">
                  <stop stopColor="#64F5DA" stopOpacity=".25" />
                  <stop offset="1" stopColor="#64F5DA" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="280" cy="280" r="250" fill="url(#star-glow)" />
              <g stroke="#64F5DA" strokeWidth=".8" opacity=".38">
                <path
                  d="M90 280 190 120 345 100 440 250 365 430 180 455 90 280 280 280 345 100M190 120 280 280 365 430M440 250 280 280 180 455M190 120 440 250M90 280 365 430"
                  fill="none"
                />
              </g>
              {[
                [90, 280],
                [190, 120],
                [345, 100],
                [440, 250],
                [365, 430],
                [180, 455],
                [280, 280],
              ].map(([x, y], i) => (
                <g key={i}>
                  <circle
                    cx={x}
                    cy={y}
                    r={i === 6 ? 12 : 5}
                    fill={i === 6 ? "#e0fff9" : "#64F5DA"}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={i === 6 ? 28 : 12}
                    fill="none"
                    stroke="#64F5DA"
                    opacity=".3"
                  />
                </g>
              ))}
            </svg>
            <span className="art-label label-one">
              <BookOpen size={17} /> Ваши идеи
            </span>
            <span className="art-label label-two">
              <Sparkles size={17} /> Новые знания
            </span>
            <span className="art-label label-three">
              <GraduationCap size={17} /> Большие открытия
            </span>
            <span className="art-coordinate">KNOWLEDGE / CONNECTED</span>
          </div>
        </section>
        <section className="landing-features" id="possibilities">
          <div className="section-heading">
            <div>
              <span className="eyebrow">МЕНЬШЕ РУТИНЫ. БОЛЬШЕ СМЫСЛА.</span>
              <h2>Пространство, где идеи обретают форму</h2>
            </div>
          </div>
          <div className="feature-grid">
            {[
              {
                n: "01",
                title: "Создавайте в своём ритме",
                text: "Редактируемые планы уроков, рабочие листы, контрольные и презентации. От чистого листа до готового файла.",
              },
              {
                n: "02",
                title: "Объединяйте класс",
                text: "Приглашайте учеников, выдавайте задания и сохраняйте оценки. Учебный процесс в одном пространстве.",
              },
              {
                n: "03",
                title: "Подключайте возможности ИИ",
                text: "Начните с ручных инструментов и демо-ответов. Подключите собственный API, когда будете готовы.",
              },
            ].map((f) => (
              <GlassCard key={f.n}>
                <span className="feature-number">{f.n} /</span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </GlassCard>
            ))}
          </div>
        </section>
        <section className="landing-features" id="instruments">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ВАША ОБРАЗОВАТЕЛЬНАЯ ОРБИТА</span>
              <h2>Один замысел. Много возможностей.</h2>
            </div>
            <button
              className="text-button"
              onClick={() => navigate("/register")}
            >
              В рабочее пространство <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="tool-grid">
            {visibleTools.map((t) => (
              <button
                key={t.type}
                className={`tool-card ${t.color}`}
                onClick={() => navigate("/register")}
              >
                <span className="tool-icon">
                  <t.icon size={22} />
                </span>
                <h3>{toolNames[t.type]}</h3>
                <p>{t.description}</p>
                <ArrowUpRight className="tool-arrow" size={17} />
              </button>
            ))}
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <p>Инструменты для тех, кто учит и учится.</p>
        <span>EduPilot © {new Date().getFullYear()}</span>
      </footer>
    </>
  );
}
function AuthPage({ register }: { register: boolean }) {
  const { navigate, refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const {
    register: field,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "teacher",
    },
  });
  const submit = handleSubmit(async (data) => {
    setBusy(true);
    setError("");
    try {
      await api("auth/" + (register ? "register" : "login"), "POST", data);
      window.location.assign("/workspace");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  });
  return (
    <div className="auth-wrap">
      <button className="brand-button" onClick={() => navigate("/")}>
        <Brand />
      </button>
      <GlassCard className="auth-card">
        <span className="eyebrow">НОВЫЕ ЗНАНИЯ НАЧИНАЮТСЯ ЗДЕСЬ</span>
        <h1>{register ? "Ваша новая орбита" : "С возвращением"}</h1>
        <p>
          {register
            ? "Создайте личное пространство для учёбы и творчества."
            : "Войдите, чтобы продолжить свои открытия."}
        </p>
        <form onSubmit={submit}>
          {register && (
            <>
              <div className="form-grid">
                <Field label="Имя">
                  <input
                    autoComplete="given-name"
                    {...field("firstName", { required: true, maxLength: 80 })}
                    required
                  />
                </Field>
                <Field label="Фамилия">
                  <input
                    autoComplete="family-name"
                    {...field("lastName", { required: true, maxLength: 80 })}
                    required
                  />
                </Field>
              </div>
              <Field label="Тип аккаунта">
                <select {...field("role")}>
                  <option value="teacher">Учитель</option>
                  <option value="student">Ученик</option>
                </select>
              </Field>
            </>
          )}
          <Field label="Электронная почта">
            <input
              type="email"
              autoComplete="email"
              {...field("email", { required: true })}
              required
            />
          </Field>
          <Field label="Пароль">
            <input
              aria-label="Пароль"
              type="password"
              minLength={register ? 10 : 1}
              maxLength={128}
              autoComplete={register ? "new-password" : "current-password"}
              {...field("password", { required: true })}
              required
            />
            {register && <small>От 10 символов, буквы и цифры.</small>}
          </Field>
          {register && (
            <Field label="Повторите пароль">
              <input
                type="password"
                autoComplete="new-password"
                {...field("confirmPassword", {
                  validate: (v) =>
                    v === watch("password") || "Пароли не совпадают",
                })}
                required
              />
              {errors.confirmPassword && (
                <small role="alert">{errors.confirmPassword.message}</small>
              )}
            </Field>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <GradientButton disabled={busy}>
            {busy
              ? "Подождите…"
              : register
                ? "Создать аккаунт"
                : "Войти в пространство"}
            <ArrowRight size={16} />
          </GradientButton>
        </form>
        <div className="auth-switch">
          {register ? "Уже есть аккаунт?" : "Ещё нет аккаунта?"}{" "}
          <button onClick={() => navigate(register ? "/login" : "/register")}>
            {register ? "Войти" : "Зарегистрироваться"}
          </button>
        </div>
      </GlassCard>
      <p className="auth-footnote">
        Ваши материалы доступны только вам и участникам ваших классов.
      </p>
    </div>
  );
}
export function ConstellationSettings({
  value,
  onChange,
  onSave,
}: {
  value: BackgroundSettings;
  onChange: (v: BackgroundSettings) => void;
  onSave: () => void;
}) {
  return (
    <div className="background-settings">
      <span className="eyebrow">ПАРАМЕТРЫ ФОНА</span>
      {[
        { key: "density", label: "Плотность", min: 60, max: 110 },
        { key: "distance", label: "Дистанция", min: 70, max: 210 },
        { key: "speed", label: "Скорость", min: 5, max: 70 },
      ].map((s) => (
        <label className="slider-field" key={s.key}>
          <span>{s.label}</span>
          <input
            type="range"
            min={s.min}
            max={s.max}
            value={(value as any)[s.key]}
            onChange={(e) => onChange({ ...value, [s.key]: +e.target.value })}
          />
          <output>{(value as any)[s.key]}</output>
        </label>
      ))}
      <div className="swatches">
        {[
          ["Mint", "#64F5DA"],
          ["Violet", "#A58BFF"],
          ["Rose", "#FF86B7"],
          ["Amber", "#FFC86B"],
        ].map(([label, color]) => (
          <button
            key={label}
            aria-label={label}
            title={label}
            className={value.color === color ? "selected" : ""}
            style={{ background: color }}
            onClick={() => onChange({ ...value, color })}
          />
        ))}
      </div>
      <label className="check-field">
        <input
          type="checkbox"
          checked={value.animated}
          onChange={(e) => onChange({ ...value, animated: e.target.checked })}
        />
        Анимация частиц
      </label>
      <div className="button-row">
        <button
          className="button secondary"
          onClick={() => onChange(defaultBackground)}
        >
          Сбросить
        </button>
        <GradientButton onClick={onSave}>Сохранить</GradientButton>
      </div>
    </div>
  );
}
function SettingsPage({ background, setBackground, saveBackground }: any) {
  const { user, ai, refresh, navigate } = useApp();
  const [saving, setSaving] = useState(false);
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await api("settings", "PATCH", {
        firstName: f.get("firstName"),
        lastName: f.get("lastName"),
        preferredSubject: f.get("preferredSubject"),
        preferredGrade: Number(f.get("preferredGrade")),
        theme: f.get("theme"),
      });
      await refresh();
      toast.success("Настройки сохранены");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <AnimatedPage>
      <header className="page-heading">
        <span className="eyebrow">ЛИЧНОЕ ПРОСТРАНСТВО</span>
        <h1>Настройки</h1>
        <p>Пусть EduPilot работает в вашем ритме.</p>
      </header>
      <div className="settings-grid">
        <GlassCard>
          <h2>Профиль и предпочтения</h2>
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="Имя">
                <input
                  name="firstName"
                  defaultValue={user.firstName}
                  required
                />
              </Field>
              <Field label="Фамилия">
                <input name="lastName" defaultValue={user.lastName} required />
              </Field>
            </div>
            <Field label="Email">
              <input value={user.email} readOnly />
            </Field>
            <div className="form-grid">
              <Field label="Предмет">
                <select
                  name="preferredSubject"
                  defaultValue={user.settings?.preferredSubject}
                >
                  {subjects.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Класс">
                <select
                  name="preferredGrade"
                  defaultValue={user.settings?.preferredGrade || 7}
                >
                  {Array.from({ length: 11 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1} класс
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Тема интерфейса">
              <select
                name="theme"
                defaultValue={user.settings?.theme || "dark"}
              >
                <option value="dark">Тёмная · Космос</option>
                <option value="light">Светлая · Рассвет</option>
              </select>
            </Field>
            <GradientButton disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить изменения"}
            </GradientButton>
          </form>
        </GlassCard>
        <GlassCard>
          <ConstellationSettings
            value={background}
            onChange={setBackground}
            onSave={() =>
              saveBackground(background)
                .then(() => toast.success("Фон сохранён"))
                .catch((e: any) => toast.error(e.message))
            }
          />
        </GlassCard>
        <GlassCard>
          <h2>Подключение ИИ</h2>
          <p className="mode-badge">
            <i />
            {ai?.mode === "live"
              ? "Live · " + ai.model
              : "Демонстрационный режим"}
          </p>
          <p>
            Настройки провайдера и API-ключ задаются на сервере в переменных
            окружения.
          </p>
          <ul className="capabilities">
            <li>
              <Check size={15} /> Ручные редакторы и экспорт доступны
            </li>
            <li>
              {ai?.text ? "✓" : "○"} Текстовый ИИ{" "}
              {ai?.text ? "настроен, запрос не проверен" : "не подключён"}
            </li>
            <li>
              {ai?.vision ? "✓" : "○"} Обработка изображений{" "}
              {ai?.vision ? "включена" : "не подключена"}
            </li>
            <li>
              {ai?.documents ? "✓" : "○"} Анализ DOCX{" "}
              {ai?.documents ? "включён" : "не подключён"}
            </li>
            <li>○ Серверная озвучка и видеогенерация не подключены</li>
          </ul>
        </GlassCard>
        <GlassCard>
          <h2>Безопасность</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              try {
                await api("password", "POST", {
                  currentPassword: f.get("currentPassword"),
                  password: f.get("password"),
                });
                form.reset();
                toast.success("Пароль обновлён. Остальные сессии завершены.");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Field label="Текущий пароль">
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="Новый пароль">
              <input
                name="password"
                type="password"
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            </Field>
            <button className="button secondary">Изменить пароль</button>
          </form>
        </GlassCard>
      </div>
    </AnimatedPage>
  );
}
function HelpPage() {
  return (
    <AnimatedPage>
      <header className="page-heading">
        <span className="eyebrow">ЦЕНТР ПОМОЩИ</span>
        <h1>Начните с маленькой идеи</h1>
        <p>EduPilot помогает подготовить материал и организовать обучение.</p>
      </header>
      <div className="help-grid">
        {[
          [
            "Как создать материал?",
            "Выберите инструмент, заполните тему и параметры, затем создайте структуру. Каждый раздел можно редактировать, добавлять и перемещать. Сохранённые материалы доступны в разделе «Мои материалы».",
          ],
          [
            "Что работает без ИИ?",
            "Регистрация, вход, ручные редакторы, история чатов, сохранение, классы, задания, оценки и экспорт. Генераторы создают редактируемые шаблоны; чат показывает помеченные демо-ответы.",
          ],
          [
            "Как подключить ИИ?",
            "В локальной версии задайте AI_API_KEY в .env. При необходимости измените AI_BASE_URL и AI_MODEL. Для размещённой версии задайте эти параметры в серверном окружении Sites. Ключ никогда не вводится в клиентские формы.",
          ],
          [
            "Как пригласить ученика?",
            "Создайте класс и получите одноразовый код. Ученик регистрируется со своей ролью и вводит код в разделе «Мои занятия». Код действует 24 часа.",
          ],
          [
            "Как экспортировать?",
            "В редакторе сохранённого материала используйте DOCX, PDF или PPTX. Переключатель «Ответы преподавателя» добавляет ключи только для владельца с ролью учителя.",
          ],
          [
            "Как отключить анимацию?",
            "На главной нажмите «Параметры фона» или откройте настройки оформления. Системная настройка уменьшения движения учитывается автоматически.",
          ],
        ].map(([title, text]) => (
          <GlassCard key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </GlassCard>
        ))}
      </div>
    </AnimatedPage>
  );
}
