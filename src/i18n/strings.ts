"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, type Locale, locale, subscribeLocale } from "./locale";

/**
 * Interface copy, one flat dictionary per language.
 *
 * No i18n library: the whole app is a handful of screens with no pluralisation
 * beyond one case, and routing-based locale segments would mean restructuring
 * an app whose entire point is a single canvas. A typed record is enough, and
 * the type makes a missing Spanish string a build error rather than a blank.
 */
export interface Strings {
	arcade: string;
	pressToBegin: string;
	start: string;
	play: string;
	settings: string;
	highScores: string;
	back: string;
	signIn: string;
	controls: string;
	escOpensMenu: string;
	hackers: string;
	roster: string;
	paused: string;
	sponsors: string;
	loadingBeatmaps: string;
	loadingBadges: string;
	loadingBoard: string;
	featured: string;
	objects: string;
	runComplete: string;
	score: string;
	accuracy: string;
	maxCombo: string;
	caught: string;
	missed: string;
	enterName: string;
	saveScore: string;
	scoreSaved: string;
	scoreQueued: string;
	retry: string;
	song: string;
	board: string;
	continue: string;
	quit: string;
	escToResume: string;
	audio: string;
	music: string;
	effects: string;
	mute: string;
	muted: string;
	levelsOnDevice: string;
	language: string;
	totalAcross: string;
	noScores: string;
	backToGame: string;
	boardOffline: string;
	run: string;
	runs: string;
	wipeLoading: string;
	wipeResults: string;
	wipeList: string;
	easy: string;
	normal: string;
	hard: string;
}

const EN: Strings = {
	arcade: "The Next Craft · Arcade",
	pressToBegin: "Press to begin · sound on",
	start: "START",
	play: "PLAY",
	settings: "SETTINGS",
	highScores: "High scores",
	back: "BACK",
	signIn: "SIGN IN",
	controls: "Arrows or A/D to move · Shift or Space to dash · Mouse to aim",
	escOpensMenu: "ESC opens the menu mid-run.",
	hackers: "Hackers",
	roster: "THE NEXT CRAFT ROSTER",
	paused: "Paused",
	sponsors: "Sponsors",
	loadingBeatmaps: "LOADING BEATMAPS...",
	loadingBadges: "LOADING BADGES...",
	loadingBoard: "LOADING BOARD...",
	featured: "FEATURED",
	objects: "objects",
	runComplete: "Run complete",
	score: "SCORE",
	accuracy: "ACCURACY",
	maxCombo: "MAX COMBO",
	caught: "CAUGHT",
	missed: "MISSED",
	enterName: "Enter name",
	saveScore: "SAVE SCORE",
	scoreSaved: "SCORE SAVED",
	scoreQueued: "SCORE SAVED LOCALLY — SYNC PENDING",
	retry: "RETRY",
	song: "SONG",
	board: "BOARD",
	continue: "CONTINUE",
	quit: "QUIT",
	escToResume: "ESC TO RESUME",
	audio: "Audio",
	music: "Music",
	effects: "Effects",
	mute: "MUTE",
	muted: "MUTED",
	levelsOnDevice: "Levels are stored on this device only. ESC opens them mid-run too.",
	language: "Language",
	totalAcross: "Total across every song played",
	noScores: "NO SCORES YET. BE FIRST.",
	backToGame: "Back to game",
	boardOffline: "?BOARD OFFLINE — RETRYING",
	run: "run",
	runs: "runs",
	wipeLoading: "LOADING",
	wipeResults: "RESULTS",
	wipeList: "LIST",
	easy: "EASY",
	normal: "NORMAL",
	hard: "HARD",
};

const ES: Strings = {
	arcade: "The Next Craft · Arcade",
	pressToBegin: "Pulsa para empezar · con sonido",
	start: "EMPEZAR",
	play: "JUGAR",
	settings: "AJUSTES",
	highScores: "Puntuaciones",
	back: "VOLVER",
	signIn: "INICIAR SESIÓN",
	controls: "Flechas o A/D para mover · Shift o Espacio para correr · Ratón para apuntar",
	escOpensMenu: "ESC abre el menú durante la partida.",
	hackers: "Hackers",
	roster: "PARTICIPANTES DE THE NEXT CRAFT",
	paused: "En pausa",
	sponsors: "Patrocinadores",
	loadingBeatmaps: "CARGANDO CANCIONES...",
	loadingBadges: "CARGANDO CREDENCIALES...",
	loadingBoard: "CARGANDO TABLA...",
	featured: "DESTACADA",
	objects: "objetos",
	runComplete: "Partida completa",
	score: "PUNTOS",
	accuracy: "PRECISIÓN",
	maxCombo: "COMBO MÁX",
	caught: "ATRAPADOS",
	missed: "FALLADOS",
	enterName: "Escribe tu nombre",
	saveScore: "GUARDAR",
	scoreSaved: "PUNTUACIÓN GUARDADA",
	scoreQueued: "GUARDADA EN ESTE EQUIPO — FALTA SINCRONIZAR",
	retry: "REINTENTAR",
	song: "CANCIÓN",
	board: "TABLA",
	continue: "CONTINUAR",
	quit: "SALIR",
	escToResume: "ESC PARA CONTINUAR",
	audio: "Audio",
	music: "Música",
	effects: "Efectos",
	mute: "SILENCIAR",
	muted: "SILENCIADO",
	levelsOnDevice:
		"Los niveles se guardan solo en este equipo. ESC también los abre durante la partida.",
	language: "Idioma",
	totalAcross: "Total de todas las canciones jugadas",
	noScores: "AÚN NO HAY PUNTUACIONES. SÉ EL PRIMERO.",
	backToGame: "Volver al juego",
	boardOffline: "?TABLA SIN CONEXIÓN — REINTENTANDO",
	run: "partida",
	runs: "partidas",
	wipeLoading: "CARGANDO",
	wipeResults: "RESULTADOS",
	wipeList: "LISTA",
	easy: "FÁCIL",
	normal: "NORMAL",
	hard: "DIFÍCIL",
};

const DICTIONARIES: Record<Locale, Strings> = { en: EN, es: ES };

export function stringsFor(which: Locale): Strings {
	return DICTIONARIES[which];
}

/**
 * Reads the stored locale after mount rather than during render: localStorage
 * does not exist on the server, and seeding from it directly would mismatch.
 */
export function useStrings(): { t: Strings; current: Locale } {
	const [which, setWhich] = useState<Locale>(DEFAULT_LOCALE);

	useEffect(() => {
		setWhich(locale());
		return subscribeLocale(setWhich);
	}, []);

	return { t: DICTIONARIES[which], current: which };
}

/** Difficulty tiers are stored as data; only their labels are translated. */
export function tierLabel(t: Strings, tier: string): string {
	if (tier === "EASY") return t.easy;
	if (tier === "NORMAL") return t.normal;
	if (tier === "HARD") return t.hard;
	return tier;
}
