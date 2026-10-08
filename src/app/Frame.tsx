import { useEffect, useState, type ReactNode } from "react";
import { readTheme, writeTheme, type Theme } from "./storage";
import { Icon, Logo } from "./ui";

/* Chrome shared by every top-level screen: start, game, planning tools, and review. */

/** The theme in effect: the viewer's choice, else the system setting. */
function useTheme(): [Theme, () => void] {
  const [chosen, setChosen] = useState<Theme | null>(readTheme);
  const system: Theme =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const theme = chosen ?? system;
  useEffect(() => {
    if (chosen) document.documentElement.dataset.theme = chosen;
  }, [chosen]);
  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    writeTheme(next);
    setChosen(next);
  };
  return [theme, toggle];
}

export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  return (
    <button className="theme-toggle" onClick={toggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
      <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
    </button>
  );
}

/** Back to the start screen. Nothing is lost: the game autosaves. */
export function HomeButton({ onHome }: { onHome: () => void }) {
  return (
    <button className="masthead-link" onClick={onHome}>
      <Icon name="home" size={16} />
      Home
    </button>
  );
}

export function Brand({ sub }: { sub: ReactNode }) {
  return (
    <div className="brand">
      <Logo />
      <div>
        <h1>WPA Desk</h1>
        <p className="brand-sub">{sub}</p>
      </div>
    </div>
  );
}

/** The AGPL's Appropriate Legal Notices. NOTICE.md requires the attribution to stay visible on every screen. */
export function Colophon() {
  return (
    <footer className="colophon no-print">
      <a href="https://ericshayhoward.com/projects/wpa-desk/">WPA Desk by Eric Shay Howard</a>
      {" · "}
      Code under the <a href="https://www.gnu.org/licenses/agpl-3.0.html">AGPL 3.0</a>, scenarios under{" "}
      <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>
      {" · "}
      <a href="https://github.com/ericshayhoward/wpa-desk">Source</a>
    </footer>
  );
}
