import type { ShoeData } from "../sim/types"

export function Shoe({
  shoe,
  camera = false,
}: {
  shoe: ShoeData
  camera?: boolean
}) {
  const isMissed = shoe.result === "no detectado"
  return (
    <div
      className={`shoe absolute ${
        shoe.result === "RECHAZO" && shoe.x > 73 ? "shoe-rejected" : ""
      }`}
      style={{
        left: `${shoe.x}%`,
        top: `${shoe.y}%`,
        rotate:
          shoe.result === "RECHAZO" && shoe.x > 73
            ? `${(shoe.y - 50) * 0.45}deg`
            : undefined,
      }}
      aria-label={`Pieza ${shoe.id}${
        shoe.defect ? `, defecto ${shoe.defect}` : ""
      }`}
    >
      <div className="shoe-tag">#{shoe.id}</div>
      {shoe.result && (
        <div className={`result-badge result-${shoe.result.replace(" ", "-")}`}>
          {shoe.result}
        </div>
      )}
      <svg
        viewBox="0 0 124 52"
        className={camera ? "w-32" : "w-[92px]"}
        aria-hidden="true"
      >
        {/* suela */}
        <path
          d="M4 27C4 15 11 8 24 8c11 0 19 5 31 5 14-1 30-7 47-4 13 2 19 10 19 18 0 9-7 16-21 17-13 1-27-4-44-4-12 0-19 5-31 5C11 45 4 38 4 27Z"
          fill="var(--shoe-sole)"
          stroke="var(--shoe-line)"
          strokeWidth="1.5"
        />
        {/* corte */}
        <path
          d="M9 27c0-8 6-13 15-13 11 0 19 5 31 5 14-1 30-6 45-3 9 2 14 7 14 12 0 7-6 12-17 13-13 1-27-4-43-4-12 0-18 5-30 5-9 0-15-5-15-15Z"
          fill="var(--shoe-upper)"
          stroke="var(--shoe-line)"
          strokeWidth="1"
        />
        {/* puntera */}
        <path
          d="M94 15c11 0 18 5 18 12s-7 12-18 12c4-4 5-8 5-12s-1-8-5-12Z"
          fill="var(--shoe-toe)"
          stroke="var(--shoe-line)"
          strokeWidth="1"
        />
        {/* talonera */}
        <path
          d="M10 27c0-8 5-12 13-13-4 4-5 8-5 13s1 9 5 13c-8-1-13-5-13-13Z"
          fill="var(--shoe-toe)"
          stroke="var(--shoe-line)"
          strokeWidth="1"
        />
        {/* boca del calzado */}
        <ellipse
          cx="34"
          cy="27"
          rx="13"
          ry="8"
          fill="var(--shoe-inside)"
          stroke="var(--shoe-line)"
          strokeWidth="1.2"
        />
        {/* lengüeta y cordones */}
        <path
          d="M48 22c14-1 28-3 42-3v16c-14 0-28-2-42-3Z"
          fill="var(--shoe-tongue)"
          stroke="var(--shoe-line)"
          strokeWidth="1"
        />
        <path
          d="M54 20.5l6 13M62 20.5l6 13M70 20.5l6 13M78 20.5l6 13M60 20.5l-6 13M68 20.5l-6 13M76 20.5l-6 13M84 20.5l-6 13"
          fill="none"
          stroke="var(--shoe-lace)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        {/* costura perimetral */}
        <path
          d="M14 27c0-6 4-10 10-10M96 12c8 1 14 6 14 15"
          fill="none"
          stroke="var(--shoe-line)"
          strokeWidth=".8"
          strokeDasharray="2 2"
          opacity=".8"
        />
        {shoe.defect === "mancha" && (
          <path
            d="M66 36c5-4 13-3 14 2s-8 7-13 5-3-5-1-7Z"
            fill="#3b2a22"
            opacity=".9"
          />
        )}
        {shoe.defect === "costura" && (
          <path
            d="M96 12c8 1 14 6 14 15"
            fill="none"
            stroke="#d6454d"
            strokeWidth="2.2"
            strokeDasharray="3 2.5"
            strokeLinecap="round"
          />
        )}
        {shoe.defect === "pegado" && (
          <path
            d="M70 45c8-3 14 0 20-2-1-3-3-6-6-6-6 3-12 1-18 4 1 2 2 3 4 4Z"
            fill="#e8d9a8"
            stroke="#b99a4a"
            strokeWidth=".8"
          />
        )}
        {isMissed && (
          <circle
            cx="70"
            cy="27"
            r="22"
            fill="none"
            stroke="#d4a04a"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        )}
      </svg>
    </div>
  )
}
