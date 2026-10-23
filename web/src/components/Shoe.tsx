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
      style={{ left: `${shoe.x}%`, top: `${shoe.y}%` }}
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
        viewBox="0 0 102 48"
        className={camera ? "w-28" : "w-[76px]"}
        aria-hidden="true"
      >
        <path
          d="M4 24C4 12 15 5 28 5h17c8 0 14 5 20 10l11 1c11 1 20 8 22 17 1 5-3 9-8 9H22C11 42 4 35 4 24Z"
          fill="var(--shoe-sole)"
          stroke="var(--shoe-line)"
          strokeWidth="2"
        />
        <path
          d="M13 21c2-7 9-11 18-11h14c7 0 13 6 18 11l17 2c7 1 11 5 12 10H25c-8 0-12-5-12-12Z"
          fill="var(--shoe-upper)"
          stroke="var(--shoe-line)"
          strokeWidth="1.4"
        />
        <path
          d="M30 13 25 31M40 12l-5 19M27 17l15 2M25 22l15 2M24 27l14 2"
          fill="none"
          stroke="var(--shoe-detail)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        {shoe.defect === "mancha" && (
          <path
            d="M59 19c6-4 13 0 11 6s-11 8-15 3 0-7 4-9Z"
            fill="#472f30"
            opacity=".92"
          />
        )}
        {shoe.defect === "costura" && (
          <path
            d="M48 34c5-5 9 4 14-1s8 4 14-1"
            fill="none"
            stroke="#e76c74"
            strokeWidth="2.2"
            strokeDasharray="3 2"
          />
        )}
        {shoe.defect === "pegado" && (
          <>
            <ellipse cx="78" cy="36" rx="7" ry="2.7" fill="#d98b43" />
            <circle
              cx="83"
              cy="29"
              r="2.4"
              fill="none"
              stroke="#d98b43"
              strokeWidth="1.5"
            />
          </>
        )}
        {isMissed && (
          <circle
            cx="66"
            cy="24"
            r="15"
            fill="none"
            stroke="#e5a43b"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        )}
      </svg>
    </div>
  )
}
