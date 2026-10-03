/*
 * Anciennes adresses de Verbheft (#/verbe/fahren), qui ont pu être mises en
 * favori ou rester ouvertes : on les traduit avant que le routeur ne lise
 * l'adresse. D'où un module à part, importé en premier par main.tsx : le
 * routeur est créé dès l'import de App.tsx, avant le corps de main.tsx.
 */
const legacy = location.hash.match(/^#\/verbe\/(.+)$/);
if (legacy) history.replaceState(null, '', `/de/${legacy[1]}`);
else if (location.hash === '#/') history.replaceState(null, '', '/de');

export {};
