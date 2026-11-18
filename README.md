# BAHIA VERDE — Sun &amp; Sirens

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/cryptocollectorid/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/cryptocollectorid/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the sun-soaked port city of **Bahia Verde**, built with three.js and no build step: `game/` is plain static files, opened in desktop Chrome.

**You are Rex Marlowe**, a getaway driver who owes Mama Rosa one favour too many. Five jobs stand between you and a clean slate: steal cars, run the docks, shake the police, settle the Venn crew, and take the bank.

## How to play

- **WASD** move / drive · **Mouse drag** orbit camera · **Wheel** zoom
- **E** enter / exit a car (parked cars are free; stealing one in traffic draws heat)
- **F** punch · **Click** shoot the pistol · **Space** handbrake · **Shift** run
- **P** pause · **Q** save · **M** mute · **Enter** confirm

## What's in the game

- **A real city:** Bahia Verde — a road grid of blocks, parks, palms, a beach and an ocean, built procedurally from a seed (`?seed=N` rebuilds the same city).
- **On foot and by car:** traffic that drives the grid, queues and turns; pedestrians on the sidewalks; cars to steal and drive with arcade physics and handbrake drift.
- **A wanted level:** crime draws stars; police cars spawn, chase, ram and bust you when they catch you slow. Stay quiet and the heat fades.
- **Five story jobs** for Mama Rosa, with a beacon, minimap marker and HUD objective for each — a pickup at the docks, a hot pursuit, a payback in Venn Alley, and the big score at the bank.
- **Combat:** fists and a pistol against the Venn thugs; health, pickups and a save system (localStorage) that keeps your cash and job progress.
- **HUD:** cash, wanted stars, health, speed, a live minimap and mission objective; synthesized engine, siren, gunshot and radio sounds (WebAudio, no files).

## How to run it

```sh
node serve.ts
# open http://localhost:8080
```

Screenshots are staged scenes of the real game: `?shot=start|drive|chase|mission&seed=1`.

## Handing it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This copies `game/` and `screenshots/` to `out/` and writes `out/dossier.json`.
