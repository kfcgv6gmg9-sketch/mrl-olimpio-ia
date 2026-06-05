type LogoProps = {
  context?: "default" | "login" | "menu";
  showText?: boolean;
};

export function Logo({ context = "default", showText = true }: LogoProps) {
  return (
    <div className={`logo logo-${context}`} aria-label="MRL Gestão">
      <div className="logo-mark" aria-hidden="true">
        MRL
      </div>
      {showText ? (
        <div className="logo-text">
          <strong>MRL Gestão</strong>
          <span>Identidade visual</span>
        </div>
      ) : null}
    </div>
  );
}
