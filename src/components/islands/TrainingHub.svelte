<script lang="ts">
  // @ts-ignore — path alias resolved by Vite at build time
  import { supabase } from '@lib/supabase';

  // ─── Props ────────────────────────────────────────────
  interface Props {
    locale?: string;
    categories?: string;
    weaknesses?: string;
    trainingStats?: string;
  }
  let {
    locale = 'is',
    categories: catStr = '[]',
    weaknesses: weakStr = '[]',
    trainingStats: statsStr = 'null',
  }: Props = $props();

  // ─── State (initialised once from server-rendered props) ───
  // svelte-ignore state_referenced_locally
  const _initCats = JSON.parse(catStr as string);
  // svelte-ignore state_referenced_locally
  const _initWeak = JSON.parse(weakStr as string);
  // svelte-ignore state_referenced_locally
  const _initStats = JSON.parse(statsStr as string);

  let categories = $state(_initCats);
  let weaknesses = $state(_initWeak);
  let trainingStats = $state(_initStats);
  let activeView = $state<'overview' | 'category'>('overview');
  let selectedCategory = $state<string | null>(null);
  let lessons = $state<any[]>([]);
  let lessonProgress = $state<Map<string, any>>(new Map());
  let loadingLessons = $state(false);

  // svelte-ignore state_referenced_locally
  const isIs = (locale as string) === 'is';

  async function openCategory(categoryId: string) {
    selectedCategory = categoryId;
    activeView = 'category';
    loadingLessons = true;

    // Fetch lessons for this category
    const { data } = await supabase
      .from('training_lessons')
      .select('*')
      .eq('category_id', categoryId)
      .order('sort_order');

    lessons = data ?? [];

    // Fetch progress
    const { data: { user } } = await supabase.auth.getUser();
    if (user && lessons.length > 0) {
      const { data: progress } = await supabase
        .from('training_progress')
        .select('*')
        .eq('player_id', user.id)
        .in('lesson_id', lessons.map(l => l.id));

      const map = new Map();
      if (progress) {
        for (const p of progress) {
          map.set(p.lesson_id, p);
        }
      }
      lessonProgress = map;
    }

    loadingLessons = false;
  }

  function backToOverview() {
    activeView = 'overview';
    selectedCategory = null;
  }

  function getCategory(id: string) {
    return categories.find((c: any) => c.id === id);
  }

  function getCategoryName(id: string): string {
    const cat = getCategory(id);
    if (!cat) return id;
    return isIs ? cat.name_is : cat.name_en;
  }

  // Priority label
  function priorityLabel(idx: number): string {
    if (idx === 0) return isIs ? '🔴 Forgangur' : '🔴 Top Priority';
    if (idx <= 2) return isIs ? '🟡 Mikilvægt' : '🟡 Important';
    return isIs ? '🟢 Aukaatriði' : '🟢 Minor';
  }
</script>

<div class="training-hub">
  {#if activeView === 'overview'}
    <!-- ═══ OVERVIEW ═══ -->

    <!-- Training stats -->
    {#if trainingStats}
      <div class="training-stats">
        <div class="ts-card">
          <div class="ts-value">{trainingStats.completedLessons}/{trainingStats.totalLessons}</div>
          <div class="ts-label">{isIs ? 'Verkefni kláruð' : 'Lessons Completed'}</div>
        </div>
        <div class="ts-card">
          <div class="ts-value">{trainingStats.totalCategories}</div>
          <div class="ts-label">{isIs ? 'Þjálfunarflokkar' : 'Categories'}</div>
        </div>
        <div class="ts-card accent">
          <div class="ts-value">
            {trainingStats.weakestCategory
              ? getCategoryName(trainingStats.weakestCategory)
              : (isIs ? 'Engin' : 'None')}
          </div>
          <div class="ts-label">{isIs ? 'Þarfnast vinnu' : 'Needs Work'}</div>
        </div>
      </div>
    {/if}

    <!-- Personalized weakness path -->
    {#if weaknesses.length > 0}
      <div class="section">
        <h2 class="section-title">🎯 {isIs ? 'Þjálfunarleið þín' : 'Your Training Path'}</h2>
        <p class="section-subtitle">{isIs ? 'Byggt á leikjunum þínum — byrjaðu á forgangsmálunum' : 'Based on your games — start with the top priorities'}</p>

        <div class="weakness-path">
          {#each weaknesses as w, idx}
            {@const cat = getCategory(w.category_id)}
            <button class="path-card" class:top={idx === 0} onclick={() => openCategory(w.category_id)}>
              <div class="path-rank">{idx + 1}</div>
              <div class="path-icon">{cat?.icon ?? '📘'}</div>
              <div class="path-info">
                <span class="path-category">{isIs ? w.name_is : w.name_en}</span>
                <span class="path-stats">
                  {w.blunder_count} {isIs ? 'villur' : 'blunders'} · {isIs ? 'meðaltap' : 'avg loss'}: {w.avg_score_loss?.toFixed(1)}
                </span>
                <span class="path-priority">{priorityLabel(idx)}</span>
              </div>
              <div class="path-progress">
                {#if w.total_lessons > 0}
                  <div class="progress-ring">
                    <span>{w.completed_lessons}/{w.total_lessons}</span>
                  </div>
                {:else}
                  <span class="no-lessons">{isIs ? 'Engin verkefni' : 'No lessons'}</span>
                {/if}
              </div>
              <div class="path-arrow">→</div>
            </button>
          {/each}
        </div>
      </div>
    {:else}
      <div class="empty-weaknesses">
        <p>{isIs ? 'Engar villur fundnar ennþá — spilaðu fleiri leiki til að fá persónulega þjálfunaráætlun!' : 'No mistakes found yet — play more games to get a personalized training plan!'}</p>
        <a href={`/${locale}/spila`} class="btn-play">🎲 {isIs ? 'Spila nú' : 'Play Now'}</a>
      </div>
    {/if}

    <!-- All categories -->
    <div class="section">
      <h2 class="section-title">📚 {isIs ? 'Allir þjálfunarflokkar' : 'All Training Categories'}</h2>
      <div class="categories-grid">
        {#each categories as cat}
          {@const weakness = weaknesses.find((w: any) => w.category_id === cat.id)}
          <button class="category-card" class:has-weakness={!!weakness} onclick={() => openCategory(cat.id)}>
            <span class="cat-icon">{cat.icon}</span>
            <strong class="cat-name">{isIs ? cat.name_is : cat.name_en}</strong>
            <p class="cat-desc">{isIs ? cat.description_is : cat.description_en}</p>
            <div class="cat-footer">
              <span class="cat-lessons">{cat.lesson_count} {isIs ? 'verkefni' : 'lessons'}</span>
              {#if weakness}
                <span class="cat-blunders">{weakness.blunder_count} {isIs ? 'villur' : 'blunders'}</span>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    </div>

  {:else if activeView === 'category'}
    <!-- ═══ CATEGORY VIEW ═══ -->
    {@const cat = getCategory(selectedCategory ?? '')}
    <button class="btn-back" onclick={backToOverview}>← {isIs ? 'Til baka' : 'Back'}</button>

    <div class="category-header">
      <span class="cat-header-icon">{cat?.icon ?? '📘'}</span>
      <div>
        <h2>{isIs ? cat?.name_is : cat?.name_en}</h2>
        <p>{isIs ? cat?.description_is : cat?.description_en}</p>
      </div>
    </div>

    {#if loadingLessons}
      <div class="loading">{isIs ? 'Hleð inn...' : 'Loading...'}</div>
    {:else if lessons.length === 0}
      <div class="empty-lessons">
        <p>{isIs ? 'Engin verkefni ennþá í þessum flokki.' : 'No lessons in this category yet.'}</p>
        <p class="text-hint">{isIs ? 'Verkefni bætast við jafnt og þétt — spilaðu leiki á meðan!' : 'Lessons are being added — play games in the meantime!'}</p>
      </div>
    {:else}
      <div class="lessons-list">
        {#each lessons as lesson, idx}
          {@const progress = lessonProgress.get(lesson.id)}
          <div class="lesson-card" class:completed={progress?.completed}>
            <div class="lesson-number">{idx + 1}</div>
            <div class="lesson-info">
              <strong>{isIs ? lesson.title_is : lesson.title_en}</strong>
              <p>{isIs ? lesson.description_is : lesson.description_en}</p>
              <div class="lesson-meta">
                <span class="lesson-diff diff-{lesson.difficulty}">
                  {lesson.difficulty === 'beginner' ? (isIs ? 'Byrjandi' : 'Beginner')
                   : lesson.difficulty === 'intermediate' ? (isIs ? 'Miðlungs' : 'Intermediate')
                   : (isIs ? 'Framhaldsæfandi' : 'Advanced')}
                </span>
                {#if progress}
                  <span class="lesson-attempts">
                    {progress.attempts} {isIs ? 'tilraunir' : 'attempts'}
                  </span>
                {/if}
              </div>
            </div>
            <div class="lesson-status">
              {#if progress?.completed}
                <span class="status-done">✅</span>
              {:else if progress}
                <span class="status-started">🔄</span>
              {:else}
                <span class="status-new">○</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .training-hub { font-family: var(--font-body, sans-serif); }

  /* Training stats */
  .training-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 32px; }
  .ts-card {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; padding: 16px; text-align: center;
  }
  .ts-card.accent { border-color: rgba(243,159,90,0.3); background: rgba(243,159,90,0.08); }
  .ts-value { font-size: 22px; font-weight: 700; color: #FAF5F0; }
  .ts-card.accent .ts-value { color: #F39F5A; font-size: 14px; }
  .ts-label { font-size: 11px; color: rgba(250,245,240,0.5); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }

  /* Sections */
  .section { margin-bottom: 32px; }
  .section-title { color: #FAF5F0; font-size: 18px; margin: 0 0 4px; }
  .section-subtitle { color: rgba(250,245,240,0.4); font-size: 13px; margin: 0 0 16px; }

  /* Weakness path */
  .weakness-path { display: flex; flex-direction: column; gap: 8px; }
  .path-card {
    display: flex; align-items: center; gap: 12px; padding: 14px 16px;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px; cursor: pointer; transition: all 0.15s;
    text-align: left; width: 100%; font-family: inherit; color: inherit;
  }
  .path-card:hover { background: rgba(255,255,255,0.08); transform: translateX(4px); }
  .path-card.top { border-color: rgba(243,159,90,0.3); background: rgba(243,159,90,0.06); }
  .path-rank {
    width: 28px; height: 28px; border-radius: 50%;
    background: rgba(243,159,90,0.2); color: #F39F5A;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; flex-shrink: 0;
  }
  .path-icon { font-size: 24px; flex-shrink: 0; }
  .path-info { flex: 1; }
  .path-category { display: block; color: #FAF5F0; font-size: 14px; font-weight: 600; }
  .path-stats { display: block; color: rgba(250,245,240,0.4); font-size: 11px; margin-top: 2px; }
  .path-priority { display: block; font-size: 10px; margin-top: 2px; }
  .path-progress { text-align: center; min-width: 50px; }
  .progress-ring { color: rgba(250,245,240,0.6); font-size: 12px; font-weight: 600; }
  .no-lessons { color: rgba(250,245,240,0.3); font-size: 10px; }
  .path-arrow { color: rgba(250,245,240,0.3); font-size: 18px; }

  /* Empty states */
  .empty-weaknesses {
    text-align: center; padding: 40px 20px; margin-bottom: 32px;
    background: rgba(255,255,255,0.03); border-radius: 12px;
  }
  .empty-weaknesses p { color: rgba(250,245,240,0.5); margin-bottom: 16px; }
  .btn-play {
    display: inline-flex; padding: 10px 24px; border-radius: 10px;
    background: linear-gradient(135deg, #AE445A, #F39F5A); color: white;
    font-weight: 600; text-decoration: none; transition: all 0.15s;
  }
  .btn-play:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(174,68,90,0.3); }

  /* Categories grid */
  .categories-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
  .category-card {
    display: flex; flex-direction: column; gap: 6px; padding: 16px;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; cursor: pointer; transition: all 0.15s;
    text-align: left; width: 100%; font-family: inherit; color: inherit;
  }
  .category-card:hover { background: rgba(255,255,255,0.08); transform: translateY(-2px); }
  .category-card.has-weakness { border-left: 3px solid #F39F5A; }
  .cat-icon { font-size: 28px; }
  .cat-name { color: #FAF5F0; font-size: 14px; }
  .cat-desc { color: rgba(250,245,240,0.4); font-size: 12px; line-height: 1.4; margin: 0; }
  .cat-footer { display: flex; gap: 12px; margin-top: 6px; }
  .cat-lessons { color: rgba(250,245,240,0.5); font-size: 11px; }
  .cat-blunders { color: #F39F5A; font-size: 11px; font-weight: 600; }

  /* Category detail view */
  .btn-back {
    background: none; border: none; color: rgba(250,245,240,0.5);
    font-size: 13px; cursor: pointer; padding: 4px 0; margin-bottom: 16px;
    font-family: inherit;
  }
  .btn-back:hover { color: #FAF5F0; }

  .category-header {
    display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px;
    padding: 20px; background: rgba(255,255,255,0.05); border-radius: 12px;
  }
  .cat-header-icon { font-size: 36px; }
  .category-header h2 { color: #FAF5F0; font-size: 22px; margin: 0 0 4px; }
  .category-header p { color: rgba(250,245,240,0.5); font-size: 13px; margin: 0; }

  /* Lessons list */
  .lessons-list { display: flex; flex-direction: column; gap: 8px; }
  .lesson-card {
    display: flex; align-items: center; gap: 14px; padding: 14px 16px;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px; transition: background 0.15s;
  }
  .lesson-card:hover { background: rgba(255,255,255,0.08); }
  .lesson-card.completed { border-color: rgba(39,174,96,0.3); }
  .lesson-number {
    width: 28px; height: 28px; border-radius: 50%;
    background: rgba(255,255,255,0.08); color: rgba(250,245,240,0.5);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 600; flex-shrink: 0;
  }
  .lesson-info { flex: 1; }
  .lesson-info strong { display: block; color: #FAF5F0; font-size: 14px; }
  .lesson-info p { color: rgba(250,245,240,0.4); font-size: 12px; margin: 2px 0 0; }
  .lesson-meta { display: flex; gap: 10px; margin-top: 4px; }
  .lesson-diff {
    font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 600;
  }
  .lesson-diff.diff-beginner { background: rgba(39,174,96,0.15); color: #27ae60; }
  .lesson-diff.diff-intermediate { background: rgba(243,159,90,0.15); color: #F39F5A; }
  .lesson-diff.diff-advanced { background: rgba(174,68,90,0.15); color: #AE445A; }
  .lesson-attempts { font-size: 10px; color: rgba(250,245,240,0.3); }
  .lesson-status { flex-shrink: 0; }
  .status-done { font-size: 18px; }
  .status-started { font-size: 16px; }
  .status-new { font-size: 18px; color: rgba(250,245,240,0.2); }

  .loading { text-align: center; padding: 40px; color: rgba(250,245,240,0.5); }
  .empty-lessons { text-align: center; padding: 40px 20px; }
  .empty-lessons p { color: rgba(250,245,240,0.5); margin-bottom: 8px; }
  .text-hint { font-size: 12px; color: rgba(250,245,240,0.3); }

  @media (max-width: 768px) {
    .training-stats { grid-template-columns: 1fr; }
    .categories-grid { grid-template-columns: 1fr; }
  }
</style>
