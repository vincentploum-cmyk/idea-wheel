// Small synthetic NHL API payloads shaped like api-web.nhle.com responses.
const P = (id, first, last, teamId, pos) => ({ playerId: id, teamId, firstName: { default: first }, lastName: { default: last }, positionCode: pos });

export const ROSTER = [
  P(1, 'Brady', 'Tkachuk', 9, 'L'), P(2, 'Tim', 'Stützle', 9, 'C'), P(3, 'Drake', 'Batherson', 9, 'R'), P(4, 'Thomas', 'Chabot', 9, 'D'),
  P(11, 'Leo', 'Carlsson', 24, 'C'), P(12, 'Cutter', 'Gauthier', 24, 'L'), P(13, 'Troy', 'Terry', 24, 'R'), P(14, 'Jackson', 'LaCombe', 24, 'D'),
  P(90, 'Linus', 'Ullmark', 9, 'G'), P(91, 'Lukas', 'Dostal', 24, 'G'),
];

const sk = (id, position, extra = {}) => ({ playerId: id, name: { default: 'X. Short' }, position, goals: 0, assists: 0, points: 0, plusMinus: 0, pim: 0, hits: 1, sog: 0, toi: '15:30', blockedShots: 0, shifts: 20, giveaways: 0, takeaways: 0, ...extra });

export function boxscore({ id = 2025021043, date = '2026-03-14', awayScore = 1, homeScore = 3, sogs = {} } = {}) {
  const s = (pid, pos) => sk(pid, pos, { sog: sogs[pid] ?? 2, goals: pid === 1 ? 2 : pid === 12 ? 1 : 0, assists: pid === 2 ? 1 : 0 });
  return {
    id, season: 20252026, gameType: 2, gameDate: date, gameState: 'OFF', gameOutcome: { lastPeriodType: 'REG' },
    awayTeam: { abbrev: 'ANA', score: awayScore, sog: 24 },
    homeTeam: { abbrev: 'OTT', score: homeScore, sog: 30 },
    playerByGameStats: {
      awayTeam: { forwards: [s(11, 'C'), s(12, 'L'), s(13, 'R')], defense: [s(14, 'D')], goalies: [{ playerId: 91, toi: '59:00', shotsAgainst: 30, saves: 27, goalsAgainst: 3, starter: true, decision: 'L' }] },
      homeTeam: { forwards: [s(1, 'L'), s(2, 'C'), s(3, 'R')], defense: [s(4, 'D')], goalies: [{ playerId: 90, toi: '60:00', shotsAgainst: 24, saves: 23, goalsAgainst: 1, starter: true, decision: 'W' }] },
    },
  };
}

let eid = 1;
const play = (type, period, time, details) => ({ eventId: eid++, typeDescKey: type, periodDescriptor: { number: period }, timeInPeriod: time, details });

export function playByPlay() {
  eid = 1;
  return {
    rosterSpots: ROSTER,
    plays: [
      play('period-start', 1, '00:00', {}),
      play('faceoff', 1, '00:00', { xCoord: 0, yCoord: 0, eventOwnerTeamId: 9 }),
      // Tkachuk: slot shot (HD), rebound 2s later (HD+1), point shot (LD), blocked point shot (LD-1)
      play('shot-on-goal', 1, '01:00', { xCoord: 80, yCoord: 2, shootingPlayerId: 1, eventOwnerTeamId: 9 }),
      play('goal', 1, '01:02', { xCoord: 84, yCoord: -1, scoringPlayerId: 1, eventOwnerTeamId: 9 }),
      play('faceoff', 1, '01:02', { xCoord: 0, yCoord: 0, eventOwnerTeamId: 24 }),
      play('missed-shot', 1, '05:00', { xCoord: 30, yCoord: 30, shootingPlayerId: 1, eventOwnerTeamId: 9 }),
      play('blocked-shot', 1, '07:00', { xCoord: 60, yCoord: -15, shootingPlayerId: 1, blockingPlayerId: 14, eventOwnerTeamId: 24 }),
      // Stützle rush: takeaway in neutral zone then shot from mid slot 3s later → 2+1
      play('takeaway', 1, '10:00', { xCoord: 10, yCoord: 5, eventOwnerTeamId: 9 }),
      play('shot-on-goal', 1, '10:03', { xCoord: 52, yCoord: 15, shootingPlayerId: 2, eventOwnerTeamId: 9 }),
      // Gauthier: goal from mid, missed from far
      play('goal', 2, '03:00', { xCoord: -55, yCoord: 10, scoringPlayerId: 12, eventOwnerTeamId: 24 }),
      play('missed-shot', 2, '09:00', { xCoord: -30, yCoord: -35, shootingPlayerId: 12, eventOwnerTeamId: 24 }),
      play('period-end', 3, '20:00', {}),
    ],
  };
}

export const PREVIEW_MD = `## **DUCKS (36-26-3) at SENATORS (32-23-9)**

**1 p.m. ET; TVAS, TSN5, KCOP-13, Victory+**

**Ducks projected lineup**

<forge-entity title="Chris Kreider" slug="chris-kreider-8475184" code="player">Chris Kreider</forge-entity> -- Leo Carlsson -- Cutter Gauthier

Jackson LaCombe -- Jacob Trouba

Lukas Dostal

***Scratched:** Frank Vatrano, Ross Johnston*

***Injured:** Troy Terry (upper body)*

**Senators projected lineup** 

Brady Tkachuk -- Tim Stutzle -- Drake Batherson

Thomas Chabot -- Artem Zub

Linus Ullmark

**Status report**

Carlsson is likely to play. [Read more](https://www.nhl.com/news/x)`;
