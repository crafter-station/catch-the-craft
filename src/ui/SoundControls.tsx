"use client";

import { useEffect, useState } from "react";
import { disposePreview, previewEffects } from "@/game/audio/preview";
import { useStrings } from "@/i18n/strings";
import {
	type AudioSettings,
	audioSettings,
	DEFAULT_AUDIO_SETTINGS,
	setAudioSettings,
	subscribeAudioSettings,
} from "@/game/audio/settings";

interface Props {
	/**
	 * Play a hitsound while the effects slider moves. Off during a run, where a
	 * preview would need a second AudioContext alongside the one driving the chart.
	 */
	preview?: boolean;
	compact?: boolean;
}

/**
 * Reads settings after mount rather than during render: localStorage does not
 * exist on the server, and seeding state from it directly would mismatch.
 */
export function useAudioSettings(): AudioSettings {
	const [settings, setSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);

	useEffect(() => {
		setSettings(audioSettings());
		return subscribeAudioSettings(setSettings);
	}, []);

	return settings;
}

export function SoundControls({ preview = false, compact = false }: Props) {
	const { t } = useStrings();
	const settings = useAudioSettings();

	useEffect(() => (preview ? disposePreview : undefined), [preview]);

	return (
		<div className={compact ? "" : "panel p-5"}>
			<div className="flex items-center justify-between">
				<p className="section-label">{t.audio}</p>
				<button
					type="button"
					onClick={() => setAudioSettings({ muted: !settings.muted })}
					className={`${settings.muted ? "keycap" : "keycap-ghost"} px-3 py-1 text-xs`}
					aria-pressed={settings.muted}
				>
					{settings.muted ? t.muted : t.mute}
				</button>
			</div>

			<div className={`mt-4 space-y-3 ${settings.muted ? "opacity-40" : ""}`}>
				<Slider
					id="volume-music"
					label={t.music}
					value={settings.music}
					onChange={(music) => setAudioSettings({ music })}
				/>
				<Slider
					id="volume-effects"
					label={t.effects}
					value={settings.effects}
					onChange={(effects) => {
						setAudioSettings({ effects });
						if (preview) void previewEffects();
					}}
				/>
			</div>
		</div>
	);
}

function Slider({
	id,
	label,
	value,
	onChange,
}: {
	id: string;
	label: string;
	value: number;
	onChange: (value: number) => void;
}) {
	return (
		<div className="flex items-center gap-4">
			<label htmlFor={id} className="w-16 text-[color:var(--text-dim)] text-xs uppercase">
				{label}
			</label>
			<input
				id={id}
				type="range"
				min={0}
				max={100}
				step={1}
				value={Math.round(value * 100)}
				onChange={(event) => onChange(Number(event.target.value) / 100)}
				className="volume-slider flex-1"
			/>
			<span className="w-10 text-right text-[color:var(--text-dim)] text-xs tabular-nums">
				{Math.round(value * 100)}
			</span>
		</div>
	);
}
