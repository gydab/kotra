/**
 * WBIF Integration Library
 * Utility functions for fetching and parsing WBIF player data
 * 
 * WBIF URLs:
 * - Profile: https://matches.wbif.net/wbif/matchlog?id={WBIF_ID}
 * - Match:   https://matches.wbif.net/wbif/match?id={MATCH_ID}
 * - Ratings: https://matches.wbif.net/wbif/ratings
 */

export interface WBIFPlayerProfile {
  wbifId: string;
  name: string;
  rating: number;
  experience: number;
  matchesRecorded: number;
  matchesAnalyzed: number;
  prOverall: number;
  prMoves: number;
  prCube: number;
  prCategory: string;       // e.g. 'Beginner', 'Intermediate', 'Advanced', 'Expert'
  opponentPrAvg: number;
  winRate: number;
  distinctOpponents: number;
  clubs: number;
  earliestMatch: string;     // ISO date
  latestMatch: string;       // ISO date
  peakRating: number;
  avgOpponentRating: number;
}

export interface WBIFMatch {
  wbifMatchId: number;
  date: string;              // ISO date
  opponentName: string;
  opponentWbifId?: string;
  playerScore: number;
  opponentScore: number;
  playerWon: boolean;
  playerOldRating: number;
  playerNewRating: number;
  playerRatingChange: number;
  playerExperience: number;
  eventName?: string;
}

/** 
 * Generate the WBIF profile URL for a player
 */
export function getWBIFProfileUrl(wbifId: string): string {
  return `https://matches.wbif.net/wbif/matchlog?id=${wbifId}`;
}

/**
 * Generate the WBIF match URL  
 */
export function getWBIFMatchUrl(matchId: number): string {
  return `https://matches.wbif.net/wbif/match?id=${matchId}`;
}

/**
 * PR category labels based on PR value
 * These come from WBIF's own classification system
 */
export function getPRCategory(pr: number): string {
  if (pr <= 5) return 'World Class';
  if (pr <= 8) return 'Expert';
  if (pr <= 12) return 'Advanced';
  if (pr <= 16) return 'Intermediate';
  if (pr <= 20) return 'Casual';
  if (pr <= 25) return 'Beginner';
  return 'Distracted';
}

/**
 * PR category in Icelandic
 */
export function getPRCategoryIs(pr: number): string {
  if (pr <= 5) return 'Heimsklassi';
  if (pr <= 8) return 'Sérfræðingur';
  if (pr <= 12) return 'Framhaldsæfandi';
  if (pr <= 16) return 'Miðlungs';
  if (pr <= 20) return 'Frístundaspilari';
  if (pr <= 25) return 'Byrjandi';
  return 'Óstaðfastur';
}

/**
 * Format a WBIF rating to display format
 */
export function formatRating(rating: number): string {
  return rating.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Get the rank/placement in Iceland based on WBIF rating
 */
export function getIcelandicRank(playerRating: number, allRatings: number[]): number {
  const sorted = [...allRatings].sort((a, b) => b - a);
  return sorted.indexOf(playerRating) + 1;
}

/**
 * Color code for rating tiers (for UI)
 */
export function getRatingColor(rating: number): string {
  if (rating >= 1700) return '#FFD700';    // Gold – top tier
  if (rating >= 1600) return '#C0C0C0';    // Silver
  if (rating >= 1550) return '#CD7F32';    // Bronze
  if (rating >= 1500) return '#4CAF50';    // Green – above average
  return '#9E9E9E';                         // Gray – developing
}

/**
 * Badge text for WBIF rating level  
 */
export function getRatingBadge(rating: number): { text: string; textIs: string; color: string } {
  if (rating >= 1700) return { text: 'Elite', textIs: 'Úrvalsflokki', color: 'text-amber-400' };
  if (rating >= 1600) return { text: 'Strong', textIs: 'Sterkur', color: 'text-gray-300' };
  if (rating >= 1550) return { text: 'Intermediate', textIs: 'Miðlungs', color: 'text-orange-400' };
  if (rating >= 1500) return { text: 'Developing', textIs: 'Í þróun', color: 'text-green-400' };
  if (rating >= 1450) return { text: 'Beginner', textIs: 'Byrjandi', color: 'text-blue-400' };
  return { text: 'Newcomer', textIs: 'Nýgræðingur', color: 'text-purple-400' };
}

/**
 * Format WBIF experience points
 */
export function formatExperience(exp: number): string {
  if (exp >= 1000) return `${(exp / 1000).toFixed(1)}k`;
  return exp.toString();
}

/**
 * Calculate rating trend (positive/negative/neutral)
 */
export function getRatingTrend(matches: WBIFMatch[]): 'up' | 'down' | 'stable' {
  if (matches.length < 2) return 'stable';
  const recent = matches.slice(0, 3);
  const totalChange = recent.reduce((sum, m) => sum + m.playerRatingChange, 0);
  if (totalChange > 5) return 'up';
  if (totalChange < -5) return 'down';
  return 'stable';
}
