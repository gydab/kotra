# Backgammon Engine Research — Algorithms, Error Calculation, and Coaching Systems

> Síðast uppfært: 3. mars 2026  
> Staða: Rannsókn (Research Only — No Code)

---

## Table of Contents

1. [Equity Calculation](#1-equity-calculation)
2. [Error Measurement](#2-error-measurement)
3. [Performance Rating (PR)](#3-performance-rating-pr)
4. [Cube Decision Analysis](#4-cube-decision-analysis)
5. [Match Equity Tables (MET)](#5-match-equity-tables-met)
6. [GNU Backgammon (gnubg) Architecture](#6-gnu-backgammon-gnubg-architecture)
7. [Building a Coaching/Training App](#7-building-a-coachingtraining-app)
8. [Existing Open-Source Engines and Tools](#8-existing-open-source-engines-and-tools)
9. [Match File Formats](#9-match-file-formats)
10. [Feasibility Assessment](#10-feasibility-assessment)

---

## 1. Equity Calculation

### 1.1 What is Equity?

**Equity** is the expected value of a backgammon position — it represents your average expected outcome measured in points (money game) or match winning chances (match play).

- **Equity = 0.000** → The position is exactly equal.
- **Equity = +1.000** → You expect to win 1 point on average.
- **Equity = -1.000** → You expect to lose 1 point on average.
- Range: typically **-3.0 to +3.0** (backgammon wins/losses at stake = 3× cube value).

### 1.2 Cubeless Money Equity (The Base Formula)

The cubeless money equity is calculated directly from the output probabilities of the neural network:

```
Equity(cubeless) = 2×P(win) - 1 + 2×(P(win gammon) - P(lose gammon)) + 3×(P(win backgammon) - P(lose backgammon))
```

Where:
- **P(win)** = probability of winning (any type) — sums to 1 with P(lose)
- **P(win gammon)** = probability of winning a gammon or backgammon
- **P(win backgammon)** = probability of winning a backgammon
- **P(lose gammon)** = probability of losing by gammon or backgammon
- **P(lose backgammon)** = probability of losing by backgammon

The neural network outputs **6 values** for each position:
1. P(win)
2. P(win gammon)
3. P(win backgammon)
4. P(lose) = 1 - P(win)
5. P(lose gammon)
6. P(lose backgammon)

### 1.3 Cubeful Equity (Janowski Model)

Real backgammon has a doubling cube, so **cubeful equity** accounts for future doubling decisions. GNU Backgammon uses Rick Janowski's model (1993):

```
E(cubeful) = E(dead) × (1 - x) + E(live) × x
```

Where:
- **E(dead)** = dead cube equity (= cubeless equity, no future cube actions)
- **E(live)** = equity assuming a perfectly "live" (infinitely redoublable) cube
- **x** = **cube efficiency** parameter (typically 0.6–0.8)
  - x = 0 → dead cube (no doubling possible)
  - x = 1 → perfectly live cube

**Cube efficiency values used by gnubg:**

| Position Class | x (Cube Efficiency) |
|---|---|
| Two-sided bearoff (exact) | n/a (exact values from database) |
| One-sided bearoff | 0.6 |
| Crashed positions | 0.68 |
| Contact positions | 0.68 |
| Race positions | Linear interpolation: 0.6 (pip count ≤40) → 0.7 (pip count ≥120) |

### 1.4 Match Winning Chance (MWC)

In match play, equity is expressed as **Match Winning Chance (MWC)** — the probability of winning the entire match from this position.

```
MWC(cubeless) = P(w) × MWC(after win) + P(l) × MWC(after loss)
                + P(wg) × MWC(after win gammon) + P(lg) × MWC(after lose gammon)
                + P(wbg) × MWC(after win bg) + P(lbg) × MWC(after lose bg)
```

MWC values after wins/losses come from the **Match Equity Table** (see Section 5).

For cubeful MWC:
```
MWC(cubeful) = MWC(dead) × (1 - x) + MWC(live) × x
```

### 1.5 Normalized Money Game Equity (NEMG / EMG)

To make MWC errors comparable across different match scores, they are **normalized** to an "Equivalent Money Game" (EMG) scale:

```
NEMG = 2 × (MWC - MWC(loss)) / (MWC(win) - MWC(loss)) - 1
```

Where:
- MWC(win) = match winning chance after winning 1 point
- MWC(loss) = match winning chance after losing 1 point

This linear rescaling maps MWC into the familiar money game range (approximately -3 to +3). It allows errors at different match scores to be compared on a common scale.

**Key insight**: When both players are far from finishing the match (e.g., 0-0 to 17), NEMG ≈ money equity. At extreme scores (e.g., Crawford games), NEMG can diverge significantly from money equity because gammon values change dramatically.

### 1.6 Neural Network Position Evaluation

GNU Backgammon uses **3 separate neural networks** for different position classes:

1. **Contact network** — for positions where the two sides' checkers are in contact
2. **Race network** — for pure racing positions (no contact)
3. **Crashed network** — for positions where one side is significantly blocked/trapped

Each network takes a **position encoding** as input (see Position ID specification in Section 9) and outputs the 6 probabilities listed above.

Additionally, gnubg uses:
- **1-sided bearoff database**: Exact probabilities for all positions with ≤15 checkers on the first 6 points
- **2-sided bearoff database**: Exact win/loss probabilities for endgame bearoff positions with ≤6 checkers each (includes cubeful equities for money game)
- **Pruning neural networks**: Faster, less accurate nets used to prune move candidates during deeper searches

---

## 2. Error Measurement

### 2.1 Definition of Error

An **error** in backgammon is defined as the equity difference between the best available move and the move actually played:

```
Error = Equity(best move) - Equity(chosen move)
```

- Error is always ≥ 0 (the best move has error = 0)
- A positive error means equity was given away — a mistake was made
- The error is calculated using the engine's evaluation at a specified ply depth

### 2.2 Types of Errors

#### Checker Play Errors
Errors made in choosing which checkers to move given a dice roll. For each dice roll, gnubg evaluates all legal moves, ranks them, and compares the player's actual move to the top-ranked move.

#### Cube Decision Errors
Errors made in cube handling:
- **Missed doubles**: Failing to offer a double when the engine says you should
- **Wrong doubles**: Doubling when you shouldn't have
- **Wrong takes**: Taking a double you should have passed
- **Wrong passes**: Passing a double you should have taken

Cube errors are further classified by their location:
- **Around the Double Point (DP)**: Near the optimal doubling point
- **Around the Too Good (TG) point**: Near positions where you're "too good" to double (should play for gammon)

### 2.3 Error Units

| Unit | Description | Typical Range |
|---|---|---|
| **Equity points** | Raw equity difference | 0.000 to ~1.000+ |
| **Milliequity points (mEq)** | Equity × 1000 | 0 to ~1000+ |
| **EMG (Equivalent Money Game)** | Normalized equity (match play → money scale) | Same as equity but normalized |
| **MWC percentage** | Match winning chance given up | 0% to ~50% |

**GNU Backgammon default**: Reports error rates as **normalized equity** (EMG), typically shown multiplied by 1000 (milliequity per decision). The number displayed in the statistics panel is the normalized total error rate per move × 1000.

### 2.4 Error Classification Thresholds (Default)

| Equity Loss | Classification | Notation |
|---|---|---|
| < 0.040 | No mark (acceptable) | — |
| 0.040 – 0.080 | Doubtful | ?! |
| 0.080 – 0.160 | Bad | ? |
| > 0.160 | Very Bad (Blunder) | ?? |

These thresholds are configurable in gnubg's analysis settings.

### 2.5 Luck Measurement

The "luck" of each roll is also computed:

```
Luck = Equity(after best move with actual roll) - Average(Equity(after best move with each possible roll))
```

| Luck Deviation | Classification |
|---|---|
| > +0.6 | Very Lucky |
| +0.3 to +0.6 | Lucky |
| -0.3 to +0.3 | Neutral |
| -0.6 to -0.3 | Unlucky |
| < -0.6 | Very Unlucky |

### 2.6 Normalized vs Unnormalized Errors

- **Normalized errors**: Expressed in EMG (equivalent money game). Allows comparison across match scores.
- **Unnormalized errors**: For money play, errors are multiplied by the cube value. For match play, the total MWC given up is reported.

**Important difference from Snowie/XG**: GNU Backgammon defines error rate per move as `total error / unforced moves`, while Snowie 4 defines it as `total error / (total moves for both players)`. This makes gnubg error rates approximately **1.4× higher** than Snowie rates for the same match. gnubg also reports an "Equivalent Snowie error rate" for cross-reference.

---

## 3. Performance Rating (PR)

### 3.1 What is PR?

**Performance Rating (PR)** is the normalized total error rate per decision, expressed in milliequity points. It is the standard metric for measuring a player's skill level in analyzed matches.

### 3.2 The PR Formula

```
PR = (Total Normalized Error in EMG) / (Number of Non-Trivial Decisions) × 1000
```

Where:
- **Total Normalized Error** = sum of all checker play and cube decision errors, normalized to EMG
- **Non-Trivial Decisions** = unforced checker play moves + close or actual cube decisions
- **× 1000** = converts from equity to milliequity for readability

An "unforced" move is one where more than one legal move exists. A "close" cube decision is one where the equities of different cube actions are within 0.16 of each other, or the position is "too good."

### 3.3 Skill Level Classifications

#### GNU Backgammon Thresholds (Normalized error rate per move × 1000):

| PR (milliequity/decision) | Rating | Description |
|---|---|---|
| 0.0 – 2.0 | **Supernatural** | Theoretically perfect or near-perfect |
| 2.0 – 5.0 | **World Class** | Top professional level |
| 5.0 – 8.0 | **Expert** | Very strong player |
| 8.0 – 12.0 | **Advanced** | Strong club player |
| 12.0 – 18.0 | **Intermediate** | Decent club player |
| 18.0 – 26.0 | **Casual Player** | Recreational player |
| 26.0 – 35.0 | **Beginner** | New to the game |
| > 35.0 | **Awful!** | Fundamental misunderstandings |

#### eXtreme Gammon (XG) Thresholds (slightly different scale):

| PR | XG Rating |
|---|---|
| < 3 | World Class |
| 3 – 5 | Expert |
| 5 – 8 | Advanced |
| 8 – 12 | Intermediate |
| 12+ | Casual/Beginner |

**Note**: XG uses 1-ply (gnubg 0-ply equivalent) for its standard analysis, and its error rates tend to be somewhat lower due to the Snowie-style denominator. XG's "1-ply" analysis is roughly equivalent to gnubg's "0-ply" analysis for evaluation purposes (but XG uses "ply" in the Snowie convention where counting starts at 1, not 0).

### 3.4 PR Components

PR is often broken down into:
- **Checker Play PR**: Error rate from checker play decisions only
- **Cube Decision PR**: Error rate from cube decisions only
- **Overall PR**: Combined checker + cube errors

### 3.5 PR to Elo Rating Relationship

There is no exact universal formula converting PR to Elo, as Elo ratings depend on the rating pool (FIBS, Galaxy, etc.). However, approximate relationships have been observed:

| PR | Approximate FIBS Elo |
|---|---|
| 2–3 | 1900–2100+ |
| 4–6 | 1700–1900 |
| 7–10 | 1550–1700 |
| 11–15 | 1400–1550 |
| 16–25 | 1200–1400 |
| 25+ | < 1200 |

**GNU Backgammon itself** rates at approximately **2000–2100 on FIBS** (the First Internet Backgammon Server) at its strongest settings, placing it in the top 5 among 6000+ rated players.

A commonly cited rough estimate: every 1 point of PR ≈ 40–50 Elo rating points. A PR difference of 0.10 points per game (ppg) ≈ 40–50 Elo difference.

### 3.6 Luck-Adjusted Results

gnubg also computes a **luck-adjusted result** to separate skill from dice fortune:

```
Luck-Adjusted Result = Actual Result + Total Unnormalized Luck Rate
```

This is based on Douglas Zare's "Hedging Toward Skill" (variance reduction) methodology and provides an unbiased measure of player strength independent of dice luck.

---

## 4. Cube Decision Analysis

### 4.1 Fundamental Cube Decisions

Every position where a player holds the cube (or the cube is centered) involves a cube decision:

1. **No Double / Double**: Should the player on roll offer a double?
2. **Take / Pass (Drop)**: If doubled, should the opponent accept or refuse?

### 4.2 Key Reference Points

#### Take Point (TP)
The minimum winning chances needed to accept a double.

- **Money game (gammon-free)**: TP = 25% (you need to win 1 out of 4 games to break even at 2:1 payout)
- **With gammons**: TP is lower or higher depending on gammon rates

Janowski's generalized take point formula:
```
TP = (L - 0.5) / (W + L + 0.5)
```
Where:
- W = average cubeless value of games ultimately won = (P(w) + P(wg) + P(wbg)) / P(w) (weighted by gammon/bg multipliers)
- L = average cubeless value of games ultimately lost

For gammon-free positions: W=1, L=1, so TP = 0.5/2.5 = 20% (live cube) or 25% (dead cube).

#### Double Point (DP)
The minimum winning chances at which doubling becomes correct. Typically above TP but below the cash point.

#### Cash Point (CP)
The opponent's take point from your perspective: CP = 100% - opponent's TP. Above this point, the opponent should pass your double, meaning you "cash" the game.

#### Too Good Point (TG)
When your winning chances are very high AND you have significant gammon chances, doubling may be wrong because you'd rather play for the gammon. The position is "too good to double."

### 4.3 Market Losers

A **market loser** is a dice roll that would move you from below the cash point to above it (or from a take to a pass for the opponent). Double decisions depend heavily on counting and analyzing market losers:

- If you have many market losers → you should double now (before the market is lost)
- If you have few market losers → you can afford to wait and double later (for better timing or gammon chances)

### 4.4 How gnubg Makes Cube Decisions

gnubg does **not** explicitly calculate take points or double points. Instead, it compares three cubeful equities:

1. **E(no double)**: Cubeful equity if you don't double this turn
2. **E(double/take)**: Cubeful equity if you double and opponent takes
3. **E(double/pass)**: = +1.000 (normalized, you win 1 point)

Decision logic:
- If E(double/take) > E(no double): → **Double** (doubling is better than not)
- If E(double/take) < -1.000: → Opponent should **pass** (taking loses more than passing)
- If E(double/take) > E(no double) AND E(double/take) < 1.000: → **Double/Take** (correct action)
- If E(no double) > E(double/take) > 1.000: → **Too good to double** (play for gammon)

### 4.5 Cube Error Quantification

A cube error is measured as:
```
Cube Error = |E(correct action) - E(chosen action)|
```

Examples:
- Missed double: Error = E(double/take) - E(no double) (or E(double/pass) - E(no double) if opponent should pass)
- Wrong take: Error = |E(pass) - E(take)| = |1.000 - E(double/take)|
- Wrong pass: Error = |E(take) - E(pass)| = |E(double/take) - (-1.000)|

### 4.6 The Janowski Cube Model in Detail

Rick Janowski's 1993 paper "Take-Points in Money Games" provides the mathematical framework:

**Live cube take point** (with gammons):
```
TP(live) = (L - 0.5) / (W + L + 0.5)
```

**Live cube equity** is computed as piecewise linear interpolation between:
- (0%, -L) — certain loss
- (TP, -1) — at take point, equity = -1
- (CP, +1) — at cash point, equity = +1
- (100%, +W) — certain win

For match play, redoubles are limited, so the live cube take point uses recursion:
```
TP(live, n-cube) = TP(effective, n-cube) × (1 - TP(live, 2n-cube))
```

Janowski also developed refined models:
- **General model**: Two separate cube efficiencies for the two players (blitzer vs. blitzee may have different cube efficiencies)
- **Extended model**: Redefines cube efficiency into a more intuitive value calculable from rollouts

### 4.7 Cube Efficiency by Position Type

Cube efficiency varies significantly by position type:
- **Holding games**: Low cube efficiency (~0.5) — hard to double effectively (either not good enough, or market lost by a mile)
- **Blitz positions**: Higher cube efficiency (~0.7+) — doubling is efficient
- **Backgames**: Low cube efficiency — timing-dependent, volatile
- **Pure races**: Medium efficiency (0.6–0.7), increases with pip count

---

## 5. Match Equity Tables (MET)

### 5.1 What is a MET?

A **Match Equity Table** is a matrix of probabilities that tells you each player's chance of winning the match at every possible score combination, **before a game starts**. It is the fundamental lookup table for all match play decisions.

For an N-point match, the MET is an N×N table where:
- MET[i][j] = probability that the player needing i more points wins the match (assuming equal skill)
- MET[i][j] + MET[j][i] = 100% (by definition)
- MET[1][1] = 50% (DMP — double match point)
- MET[0][j] = 100% (already won)

### 5.2 How METs are Used

METs affect every decision in match play:
- **Gammon values**: At different scores, gammons are worth more or less. At DMP (double match point), gammons are worthless. When Crawford rule applies, gammon values change dramatically.
- **Cube decisions**: Take points and double points change based on score. A player who is leading has different cube handling than a trailer.
- **Checker play**: Move selection can change based on match score because preferred gammon/backgammon frequencies change.

### 5.3 The Kazaross-XG2 MET (Recommended)

The **Rockwell-Kazaross** or **Kazaross-XG2** MET is the current gold standard, recommended by both gnubg and XG:

- Created by rolling out the initial position for every score pair up to -15:-15
- Uses a strong bot playing itself
- Represents the best available estimate of true match equities

Sample values from the Kazaross-XG2 MET:

| Away\Away | 1 | 2 | 3 | 4 | 5 | 7 | 9 |
|---|---|---|---|---|---|---|---|
| **1** | 50.0 | 68.5 | 75.1 | 79.9 | 83.4 | 88.5 | 91.9 |
| **2** | 31.5 | 50.0 | 59.5 | 66.1 | 71.2 | 79.0 | 84.4 |
| **3** | 24.9 | 40.5 | 50.0 | 57.1 | 63.0 | 72.4 | 79.1 |
| **4** | 20.1 | 33.9 | 42.9 | 50.0 | 56.2 | 66.4 | 74.0 |
| **5** | 16.6 | 28.8 | 37.0 | 43.8 | 50.0 | 60.8 | 69.1 |
| **7** | 11.5 | 21.0 | 27.6 | 33.6 | 39.2 | 50.0 | 59.2 |
| **9** | 8.1 | 15.6 | 20.9 | 26.0 | 30.9 | 40.8 | 50.0 |

### 5.4 Other METs (Historical)

| MET | Notes |
|---|---|
| **Woolsey** | Used for early hand calculations; now considered obsolete |
| **Snowie** | Used by Snowie software; slightly different from modern rollouts |
| **g11** | Earlier gnubg default; obsolete |
| **Jacobs/Trice** | Includes adjustments for skill differences (50 or 100 Elo points apart) |
| **Zadeh** | Early theoretical MET |

### 5.5 Crawford Rule Impact

The Crawford rule states: when one player is 1 point from winning, neither player may double in the immediately next game. This creates:
- A **Crawford game** with special handling (no cube)
- Post-Crawford games where the trailing player should double immediately (since they have nothing to lose — a simple loss or a dropped double are both equivalent)

All METs encode Crawford-game equities separately.

### 5.6 How Match Score Affects Decisions

Some key match score effects:
- **DMP (Double Match Point)**: Gammons are worthless; play to maximize wins regardless of gammon risk
- **GS/GG scores**: When a gammon wins the match for one player, they take extra risks for gammons
- **Free drop**: Post-Crawford, the leader can pass a double at no cost (they're already 1-away)
- **Trailer cube strategy**: The trailing player is more aggressive with the cube, often doubling early or playing for gammons

---

## 6. GNU Backgammon (gnubg) Architecture

### 6.1 Project Information

| Property | Value |
|---|---|
| **License** | GNU General Public License v3 (GPLv3) |
| **Language** | C (core engine), Python (scripting extension) |
| **Repository** | https://git.savannah.gnu.org/cgit/gnubg.git |
| **NN Training Repo** | https://git.savannah.gnu.org/cgit/gnubg/gnubg-nn.git |
| **Latest Release** | v1.08.003 (April 2024) |
| **Platforms** | Linux, Windows, macOS, BSD, Raspberry Pi |
| **FIBS Rating** | ~2000–2100 (top 5 of 6000+ players) |
| **Primary Developers** | Philippe Michel, Michael Petch, Øystein Schønning-Johansen, Christian Anthon, et al. |
| **Download** | https://ftp.gnu.org/gnu/gnubg/ |

### 6.2 Neural Network Architecture

gnubg uses **3 separate neural networks** (standard multi-layer perceptrons):

1. **Contact Net**: For positions where both sides have checkers in contact
2. **Race Net**: For pure racing positions
3. **Crashed Net**: For positions where one side has checkers trapped behind a prime

Additionally:
- **Pruning neural networks**: Smaller/faster nets used to quickly eliminate poor move candidates during deep searches (less than 1% of moves change with vs. without pruning nets)
- **Bearoff databases**: Replace neural nets for endgame positions (exact calculation)

**Each network outputs 6 values**: P(win), P(win gammon), P(win backgammon), P(lose gammon), P(lose backgammon), and P(lose) is derived as 1-P(win).

**Input encoding**: The board position is encoded as a binary vector. The Position ID is an 80-bit representation (10 bytes) that uniquely identifies any board position. It's encoded as 14-character Base64 for human readability.

### 6.3 Evaluation Pipeline

```
Position → Classify (Contact/Race/Crashed/Bearoff)
    ↓
If Bearoff → Look up exact probabilities from database
If Neural Net → Feed position encoding to appropriate NN → Get 6 output probabilities
    ↓
Compute cubeless equity from probabilities
    ↓
Apply Janowski model → Get cubeful equity
    ↓
If match play → Convert to MWC using Match Equity Table
    ↓
Optionally normalize to EMG/NEMG
```

### 6.4 Ply Depths and Move Filters

**Ply convention**: gnubg counts plies starting at 0 (Snowie/XG start at 1). gnubg 0-ply = Snowie 1-ply, gnubg 2-ply = Snowie 3-ply.

| gnubg Ply | Snowie Equivalent | Description | Speed |
|---|---|---|---|
| 0-ply | 1-ply | Direct NN evaluation only | Very fast (~100k+ evals/sec) |
| 1-ply | 2-ply | Look ahead 1 roll (21 possible dice × ~20 moves = ~420 positions) | Fast |
| 2-ply | 3-ply | Look ahead 2 rolls (~420 × 400 positions) | Moderate (~1 min/match analysis) |
| 3-ply | 4-ply | Look ahead 3 rolls | Slow but fast on modern hardware |
| 4-ply | 5-ply | Look ahead 4 rolls | Very slow (suitable for analysis, not play) |

**Move filters** prune the move list at each ply to keep computation tractable:
- Accept N moves unconditionally at a given ply
- Add up to M extra moves if they're within threshold T equity of the best move
- The predefined "Normal" filter: accept 0 moves, add up to 8 within 0.160 at 0-ply

**Predefined strength levels:**

| Level | Ply | Noise | Approx. Strength |
|---|---|---|---|
| Beginner | 0 | 0.060 | Weak |
| Casual | 0 | 0.050 | Weak |
| Intermediate | 0 | 0.030 | Medium |
| Advanced | 0 | 0.015 | Good |
| Expert | 0 | 0.000 | Strong (0-ply, no noise) |
| World Class | 2 | 0.000 | Very strong (2-ply, normal filter) |
| Supremo | 2 | 0.000 | Very strong (2-ply, large filter) |
| Grandmaster | 3 | 0.000 | Extremely strong |

### 6.5 Rollouts

A **rollout** is a Monte Carlo simulation of a position. gnubg plays out the position thousands of times against itself using specified evaluation settings and reports the average outcome.

Key features:
- **Truncation**: Stop early and use NN evaluation instead of playing to completion (trades systematic error for speed)
- **Race database truncation**: When entering the 2-sided bearoff database, exact equity is used (zero error)
- **Variance reduction**: Uses differences between consecutive ply evaluations to reduce noise
- **Quasi-random dice (stratified sampling)**: Ensures uniform distribution of first rolls — 36 trials guarantee each first roll appears exactly once; 1296 trials guarantee all 2-roll combinations
- **Standard error reporting**: Rollouts report confidence intervals

Typical rollout sizes:
- Quick: 36–144 trials
- Standard: 1296 trials (full first-roll rotation)
- Deep: 1296+ trials with extended settings

### 6.6 APIs and Integration

#### Command-Line Interface (CLI)
gnubg can be run as `gnubg -t` (text mode / tty). Commands can be piped in:
```bash
gnubg -t -c commands.txt    # Execute commands from file and exit
```

#### Python Scripting API
gnubg has a built-in Python module (`gnubg`) with functions:

| Function | Description |
|---|---|
| `gnubg.command(cmd)` | Execute any gnubg command |
| `gnubg.board()` | Get current board position |
| `gnubg.evaluate()` | Evaluate current position |
| `gnubg.match()` | Return full match data as Python dictionary |
| `gnubg.navigate()` | Navigate through match |
| `gnubg.eq2mwc()` | Convert equity to MWC |
| `gnubg.mwc2eq()` | Convert MWC to equity |
| `gnubg.cubeinfo()` | Get cube information |
| `gnubg.met()` | Get match equity table |
| `gnubg.positionid()` | Get position ID string |
| `gnubg.positionfromid()` | Set position from ID |
| `gnubg.evalcontext()` | Get/set evaluation context |

The `gnubg.match(analysis=1, boards=1, statistics=1)` function returns a structured dictionary with complete match data including analysis, game actions, cube decisions, and statistics.

#### Batch Processing
gnubg can analyze matches non-interactively:
```bash
gnubg -t -c "import mat match.mat; analyse match; export match text analysis.txt"
```

#### Python as External Process
gnubg can also be launched as a subprocess and controlled via its command interface. Python scripts can use `gnubg -t -p script.py` to execute analysis scripts.

#### Relational Database Support
gnubg supports storing analysis results in:
- **SQLite** (built-in)
- **MySQL**
- **PostgreSQL**

---

## 7. Building a Coaching/Training App

### 7.1 Data Requirements

#### Match Files
- **.mat (Jellyfish Match)**: The most common format from online play (BG Studio Heroes exports .mat)
- **.sgf (Smart Game Format)**: gnubg's native format; stores moves, analysis, commentary
- **.txt (Snowie Text)**: Alternative analysis format

#### Player Data Needed
- Multiple analyzed matches per player (minimum 20–50 matches for reliable stats)
- Match metadata: date, opponent, match length, score
- Analysis at consistent ply depth (2-ply minimum for reliable results)

### 7.2 Identifying Weak Areas from Error Patterns

A coaching system should categorize errors by:

#### Error Categories / Position Types

| Category | Description | What to Look For |
|---|---|---|
| **Bearing Off** | End-game checker removal errors | Wastage errors, wrong order of bearoff |
| **Blitz/Attack** | Attacking a vulnerable opponent | Timing errors, too aggressive/passive |
| **Prime Play** | Building and using primes | Failing to extend primes, breaking too early |
| **Anchor Decisions** | Making/breaking anchors in opponent's board | Wrong anchor placement, abandoning too early |
| **Back Game** | Playing from behind the opponent's prime | Timing management, too many checkers back |
| **Holding Game** | Maintaining a defensive anchor | Failing to transition, doubling errors |
| **Race** | Pure dice-efficiency racing | Pip-count inefficiency, wrong checker distribution |
| **Cube Handling** | Doubling/take/pass decisions | Missed doubles, wrong takes/passes |
| **Opening & Reply** | First few moves of the game | Non-standard openings, poor replies |
| **Safety vs Bold** | Risk/reward decisions | Over-cautious play, unnecessary risks |
| **Contact Play** | Mid-game with checker interaction | Splitting, slotting, hit-or-not decisions |

#### Metrics per Category
- **Error frequency**: How many errors per decision in this category
- **Error magnitude**: Average size of errors when they occur
- **Pattern detection**: Specific recurring mistakes (e.g., always fails to slot in blitz positions)

### 7.3 Existing Coaching Approaches

#### eXtreme Gammon (XG) Tutor Mode
- Real-time analysis during play
- Alerts when a mistake exceeds a configurable threshold
- Shows top move candidates with equity differences
- Categorizes decisions: doubtful, bad, very bad
- Match analysis with full statistics and breakdown

#### GNU Backgammon Tutor Mode
- Similar to XG: analyses each move during play
- Configurable threshold (warn on bad, very bad, etc.)
- Options: warn on checker play only, cube only, or both
- Player can rethink, view hints, or play anyway
- Cannot be used for "training mode" with saved problem sets out of the box

#### BG Galaxy Blunder Analysis
- Online platform with built-in analysis
- Shows PR and error breakdown after matches
- Rating history tracking

#### Common Training Methods Used by Players
1. **Position quizzes**: Show a position, ask "what's the best move?" or "double or no double?"
2. **Match review**: Walk through a match, stopping at errors to study
3. **Themed drills**: Focus on one position type (bearoff, blitz, prime, etc.)
4. **Opening study**: Memorize optimal opening moves and replies

### 7.4 Spaced Repetition for Backgammon

Applying spaced repetition (Anki-style) to backgammon is feasible:

1. **Position cards**: Each card is a position with a decision (move or cube)
2. **Difficulty rating**: Based on how far the player's answer deviates from the engine's top choice
3. **Interval adjustment**: Correctly answered → longer interval; failed → review sooner
4. **Position generation**: Extract from player's own matches (personalized), or from curated problem sets
5. **Category tagging**: Tag each position by type for targeted study

**Challenges**:
- Backgammon has far more unique positions than chess patterns — harder to "memorize"
- The dice element means pattern recognition is about understanding **principles**, not memorizing specific positions
- A given position might appear once and never recur exactly — the goal is to train general skills
- Positions need to be graded by difficulty/topic for effective spaced repetition

### 7.5 Coaching App Feature Ideas

1. **Match Import & Analysis**: Upload .mat/.sgf files → analyze with gnubg → show PR, errors, categories
2. **Error Dashboard**: Visualize weak areas over time (charts of PR trends, category breakdowns)
3. **Problem Generator**: Extract the player's own blunders and present them as drill positions
4. **Themed Drills**: Curated position sets for specific skills (bearoff, cube handling, etc.)
5. **Progress Tracking**: Track PR improvement over time, category-specific improvement
6. **Leaderboard**: Compare PR among club members (Kotrusamband Íslands players)
7. **Spaced Repetition Engine**: Present positions at optimal intervals based on retention
8. **AI Opponent**: Adjustable-strength play using gnubg's noise/ply settings

---

## 8. Existing Open-Source Engines and Tools

### 8.1 GNU Backgammon (gnubg)

| Property | Detail |
|---|---|
| **Status** | Actively maintained (latest release April 2024) |
| **License** | GPLv3 |
| **Strength** | ~2000–2100 FIBS Elo; top professional level |
| **Languages** | C engine + Python scripting |
| **Platforms** | Linux, Windows, macOS, BSD, ARM |
| **Neural Networks** | 3 custom nets (contact, race, crashed) + pruning nets |
| **Integration** | CLI, Python API, batch processing, relational DB export |
| **File Formats** | Import: .mat, .sgf, .pos, .sgg, .tmg, .gam, .txt. Export: .html, .pdf, .tex, .mat, .sgf, .txt, .png, .ps, .svg |
| **Documentation** | Full manual at gnu.org/software/gnubg/manual/ |
| **Localization** | 15 languages including Icelandic (is_IS) |

**Key advantage for kotra.is**: gnubg includes Icelandic localization and is the only world-class open-source engine.

### 8.2 FIBS Bots

The **First Internet Backgammon Server** (FIBS) hosts several bots:
- Some bots use gnubg as their engine
- **BlunderBot** uses gnubg with added noise (deterministic) for weaker play
- FIBS uses a Kaufman-Elo rating system (described in Section 3.5)

### 8.3 Modern Neural Network Approaches

Unlike chess (where Stockfish NNUE, Leela Chess Zero, and AlphaZero revolutionized the field), backgammon has seen less modern deep learning activity:

| Project | Status | Notes |
|---|---|---|
| **TD-Gammon** (Gerald Tesauro, 1992) | Historical / foundational | The original NN-based backgammon engine. Used temporal difference learning. Inspired gnubg's approach. |
| **gnubg** | Active | Uses traditional MLPs trained with TD-learning; still state of the art for open source |
| **BGBlitz** | Commercial, closed source | Strong commercial engine by Frank Berger; ~2100+ FIBS strength |
| **eXtreme Gammon (XG)** | Commercial, closed source | Strongest commercial engine (~2200 FIBS); proprietary NN architecture |
| **Palamedes** | Open source (Java) | Research project; not as strong as gnubg |
| **TDGammon-style reproductions** | Various GitHub repos | Academic reproductions of Tesauro's approach using modern frameworks (TensorFlow/PyTorch) |
| **OpenSpiel (Google DeepMind)** | Open source | Framework for RL research; includes backgammon environment but not a competitive engine |

**Why no "AlphaZero for backgammon"?**
- Backgammon's element of randomness (dice) makes it fundamentally different from chess
- TD-learning (the original approach) already works extremely well for backgammon
- The commercial sector (XG, BGBlitz) hasn't published their advances
- The existing open-source solution (gnubg) is strong enough for most purposes
- Academic interest shifted to other games (Go, poker, Starcraft)

### 8.4 REST APIs and Libraries

**No known public REST APIs** for backgammon analysis exist as of this writing.

Potential approaches:
1. **Wrap gnubg in a REST API**: Use gnubg's CLI + Python interface, wrap in Flask/FastAPI
2. **Wrap gnubg's C library directly**: gnubg's evaluation functions could theoretically be extracted and compiled as a library, but this is non-trivial (the code is not designed as a library)
3. **Use gnubg as a subprocess**: Launch gnubg with `-t -c` flags, pipe commands in/out
4. **Python ctypes/CFFI**: Bind to gnubg's evaluation functions directly (requires significant effort)

### 8.5 Other Relevant Tools

| Tool | Description |
|---|---|
| **Backgammon Studio** / **BG Studio Heroes** | Online play platform used by WBIF; no public API |
| **Backgammon Galaxy** | Online play with built-in analysis; no public API |
| **Backgammon NJ** | Online play platform; no public API |
| **BGNJ** | NJ's mobile-focused platform |
| **bgammon.org** | Open-source backgammon server (Go language, AGPLv3) |
| **fibs2html** | Converts FIBS logs to HTML (open source) |

---

## 9. Match File Formats

### 9.1 Jellyfish Match Format (.mat)

The .mat format was originated by the Jellyfish backgammon program and is the most widely used format for recording backgammon matches.

**Structure:**
```
N point match

 Game 1
 Player1 : Score1   Player2 : Score2
  1) Die1Die2: Move1                       Die3Die4: Move2
  2) Die1Die2: Move1                       Die3Die4: Move2
  ...
     Doubles => CubeValue     Takes / Drops
  ...
     Wins N points

 Game 2
 ...
```

**Key elements:**
- Header line with match length
- Game headers with current scores
- Move lines with roll and move notation (e.g., `31: 8/5 6/5`)
- Cube actions: `Doubles => 2`, `Takes`, `Drops`
- Resignations and results
- Each game ends with win declaration

**Example:**
```
 5 point match

 Game 1
 gnubg : 0                 Player : 0
  1) 31: 8/5 6/5                          42: 24/20 13/11
  2) 62: 13/7 13/11                       53: 13/8 13/10
  3) 54: 24/15
     Doubles => 2                         Takes
     42: 15/11 11/9                       43: 20/13
  ...
     Wins 2 points
```

**Parsing notes:**
- No formal specification exists; software implementations vary slightly
- gnubg's import handles most common variations ("Jellyfish Match is not formally defined and software exporting matches to this format often produce minor discrepancies")
- Moves use `from/to` notation where points are numbered from the player's perspective
- Bar is typically represented as `bar/point` for entering
- Bearing off uses `point/off`
- Doubles use notation like `55:` (four moves with value 5)

### 9.2 Smart Game Format (.sgf)

SGF is gnubg's native format. It's a tree-structured text format originally designed for Go.

**Structure:**
```
(;FF[4]GM[6]AP[GNU Backgammon:1.08.003]MI[length:7][game:0][ws:0][bs:0][...]
;B[31]
;W[42]
...
)
```

**Key properties (backgammon-specific):**
- `GM[6]` — Game type 6 = backgammon
- `MI` — Match information (length, scores, Crawford)
- `B[dice]` — Black's roll
- `W[dice]` — White's roll
- Move notation encoded in SGF property values
- Analysis data stored as custom properties (DA, A — analysis/annotation)

**gnubg SGF extensions:**
- Stores complete analysis results (evaluation depth, probabilities, equities)
- Stores commentary and annotations
- Stores game statistics
- Can be reloaded with analysis intact (no re-analysis needed)

**Advantages over .mat:**
- Stores analysis data alongside moves
- Tree structure supports variations/annotations
- Well-defined format specification
- Supports all gnubg features (positions, cube decisions, commentary)

### 9.3 Other Formats

| Format | Extension | Notes |
|---|---|---|
| Jellyfish Position | .pos | Single position (not a match) |
| Snowie Text | .txt | Snowie's text export format |
| GridGammon Save | .sgg | GridGammon game files |
| TrueMoneyGames | .tmg | TMG file format |
| FIBS Oldmoves | — | FIBS server logs |
| GammonEmpire/PartyGammon | .gam | Older platform formats |

### 9.4 Position ID and Match ID

gnubg defines compact encodings for positions:

**Position ID** (14 chars Base64): Encodes the board — which checkers are where. 80-bit binary key encoding up to 15 checkers per player on 24 points + bar.

Example: Starting position = `4HPwATDgc/ABMA`

**Match ID** (12 chars Base64): Encodes match state — cube value, cube owner, score, dice, Crawford flag, player on turn, etc. 66-bit binary key.

These IDs together fully specify any match position and are used for:
- Copy/paste between programs
- Position exchange in forums and email
- eXtreme Gammon also accepts gnubg Position IDs (and gnubg accepts XG IDs)

### 9.5 Parsing Approaches

For implementing .mat parsing:
1. **Line-by-line text parsing**: .mat files are plain text with consistent structure
2. **Existing parsers in gnubg source code**: The `import.c` file in gnubg contains battle-tested parsing code for .mat and other formats (GPLv3 licensed)
3. **Python libraries**: Several community Python parsers exist on GitHub (search: "backgammon mat parser python")
4. **gnubg as parser**: Import .mat into gnubg, export as .sgf or use Python API to extract data

---

## 10. Feasibility Assessment

### 10.1 Overall Feasibility: **HIGH — Very Feasible**

Building a custom backgammon coaching app for Kotrusamband Íslands is **entirely feasible** with existing tools. The key enabler is gnubg's open-source engine and Python API.

### 10.2 Architecture Options

#### Option A: gnubg as Backend Engine (RECOMMENDED)

```
┌─────────────────────────────────────────────┐
│              kotra.is Frontend               │
│         (Next.js / SvelteKit / Astro)        │
├─────────────────────────────────────────────┤
│          REST API Layer (FastAPI / Express)   │
├──────────┬──────────────────────────────────┤
│ gnubg    │  PostgreSQL                       │
│ Engine   │  - Players, matches, analysis     │
│ (CLI or  │  - Error statistics, PR history   │
│  Python) │  - Position library for drills    │
├──────────┴──────────────────────────────────┤
│          .mat / .sgf File Processing         │
│    Parse → Analyze → Store → Categorize      │
└─────────────────────────────────────────────┘
```

**Pros:**
- World-class analysis engine, free, open source
- Python API available
- Handles all file format parsing
- License (GPLv3) is compatible with a web service (you don't distribute gnubg)
- Proven, battle-tested over 20+ years
- Icelandic localization already included

**Cons:**
- gnubg is not designed as a library; integration requires subprocess or C-level work
- Analysis is CPU-bound; need to manage concurrent requests
- UI is desktop-focused; must build web UI from scratch

#### Option B: Build Custom Neural Network

**NOT recommended** for this project:
- Would require massive effort to reach gnubg's quality level
- TD-Gammon-style training is well understood but requires extensive compute + expertise
- No clear advantage over using gnubg
- Time estimate: 6–18 months of ML engineering work just for the engine

#### Option C: Commercial Engine API

**Not available**: Neither XG nor BGBlitz offer public APIs or licensing for third-party integration.

### 10.3 Recommended Architecture Detail

```
Phase 1: Match Import & Analysis
├── Accept .mat file upload
├── Run gnubg analysis (batch, via CLI)
├── Parse gnubg output/SGF for error data
├── Store results in PostgreSQL
└── Display PR, error breakdown, game review

Phase 2: Error Categorization & Coaching
├── Categorize errors by position type
├── Build player weakness profile
├── Generate drill positions from player's errors
├── Track improvement over time
└── Compare with other KSÍ players

Phase 3: Interactive Training
├── Position quiz system
├── Spaced repetition engine
├── Adjustable-difficulty AI opponent (gnubg with noise)
└── Opening trainer / cube decision trainer
```

### 10.4 Time/Effort Estimates

| Component | Effort | Complexity |
|---|---|---|
| **.mat file parsing** | 1–2 weeks | Low — well-documented format, gnubg can do it |
| **gnubg integration (CLI batch)** | 2–3 weeks | Medium — subprocess management, output parsing |
| **PR calculation & storage** | 1 week | Low — gnubg computes, we just store |
| **Error categorization** | 3–4 weeks | Medium/High — position classification is non-trivial |
| **Web dashboard (PR trends, stats)** | 2–3 weeks | Medium — standard web dev |
| **Game review UI** | 3–4 weeks | Medium/High — board rendering, move navigation |
| **Position quiz system** | 2–3 weeks | Medium — board rendering + answer checking |
| **Spaced repetition** | 2 weeks | Low/Medium — well-known algorithms (SM-2, etc.) |
| **AI opponent (web-based)** | 4–6 weeks | High — real-time gnubg integration, WebSocket play |
| **Total MVP (Phase 1)** | **8–12 weeks** | For match analysis + dashboard |
| **Full coaching system** | **4–6 months** | All three phases |

### 10.5 Main Technical Challenges

1. **gnubg integration**: Not designed as a library. Best approach is CLI subprocess or using the Python module within a Python service. Real-time play requires WebSocket + careful process management.

2. **Analysis speed**: gnubg 2-ply analysis of a 7-point match takes ~1 minute. For batch processing uploaded matches, this is fine. For real-time hints during play, 0-ply is instant but less accurate.

3. **Board visualization**: No off-the-shelf web component for backgammon boards. Need to build or adapt one (SVG/Canvas). gnubg can export PNG positions, but a dynamic interactive board needs custom work.

4. **Position classification**: Automatically categorizing a position as "blitz," "prime," "holding game," etc. is a non-trivial ML/heuristic problem. Could use gnubg's position classification (contact/race/crashed) as a starting point and add custom heuristics.

5. **Scale**: For a national association (likely <100 active players), scale is not a concern. A single server can handle all analysis needs.

### 10.6 Key Dependencies

| Dependency | Risk | Mitigation |
|---|---|---|
| gnubg availability | Very Low | Established GNU project, GPLv3, source code available |
| Match file supply | Medium | BG Studio Heroes is the main source; no API, manual upload required |
| Development expertise | Medium | Requires backend dev + gnubg knowledge |
| Server resources | Low | Single VPS can handle analysis workload for small association |

### 10.7 Recommendation

**Start with Option A (gnubg as backend) and build in phases:**

1. **MVP (8–12 weeks)**: Match upload → gnubg batch analysis → PR dashboard → Error breakdown
2. **Phase 2 (additional 4–8 weeks)**: Position drills from player's own errors, category analysis
3. **Phase 3 (additional 4–8 weeks)**: Interactive board, quiz mode, spaced repetition, AI play

This approach delivers value quickly while building toward a comprehensive coaching system. The gnubg engine provides world-class analysis for free, and the main development effort is in the web UI and data pipeline — areas where the team already has planned expertise (Next.js/SvelteKit + PostgreSQL).

---

## References

1. **GNU Backgammon Manual**: https://www.gnu.org/software/gnubg/manual/gnubg.html
2. **GNU Backgammon Source**: https://git.savannah.gnu.org/cgit/gnubg.git
3. **Janowski, Rick** (1993): "Take-Points in Money Games" — http://www.bkgm.com/articles/Janowski/cubeformulae.pdf
4. **Zare, Douglas**: "Hedging Toward Skill" — https://www.bkgm.com/articles/Zare/HedgingTowardSkill.html
5. **Tesauro, Gerald** (1992): "Practical Issues in Temporal Difference Learning" (TD-Gammon)
6. **Backgammon Galore FAQ**: https://bkgm.com/faq/
7. **FIBS Elo/Kaufman Rating System**: https://bkgm.com/faq/Ratings.html
8. **Kazaross-XG2 MET**: Bundled with gnubg and XG; rollout-based match equity table
9. **Kaufman, Larry** (1991): "Rating System for Backgammon" — Inside Backgammon magazine
10. **GNU Project**: https://www.gnu.org/software/gnubg/
