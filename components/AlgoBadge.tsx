/**
 * Compact property pill used in the sidebar nav.
 * Uses the same tokens as InfoBadge so both surfaces stay in sync.
 */

import {
  TIME_TOKEN,
  SPACE_TOKEN,
  stableToken,
  onlineToken,
} from "@/lib/badge-tokens";

type Props =
  | { kind: "time";   value: string  }
  | { kind: "space";  value: string  }
  | { kind: "stable"; value: boolean }
  | { kind: "online"; value: boolean };

export default function AlgoBadge(props: Props) {
  let token, label: string;

  switch (props.kind) {
    case "time":
      token = TIME_TOKEN;
      label = props.value;
      break;
    case "space":
      token = SPACE_TOKEN;
      label = props.value;
      break;
    case "stable":
      token = stableToken(props.value);
      label = props.value ? "stable" : "unstable";
      break;
    case "online":
      token = onlineToken(props.value);
      label = props.value ? "online" : "offline";
      break;
  }

  const Icon = token.icon;
  const mono = props.kind === "time" || props.kind === "space";

  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-px rounded leading-tight${mono ? " font-mono" : ""}`}
      style={{ background: token.bg, color: token.color }}
    >
      <Icon size={8} strokeWidth={2} />
      {label}
    </span>
  );
}
