class OutlineByHeadingWidget extends api.NoteContextAwareWidget {
  static get parentWidget() {
    return 'note-detail-pane'
  }
  get position() {
    return 100
  }

  constructor() {
    super()
    this.contentSized()

    // ====== 설정 ======
    this.ACTIVATE_LABEL = null // (null 은 어디든 / "outline" 은 #outline 일 때만)

    this.READONLY_SELECTOR = '.note-detail-readonly-text-content'
    this.EDITABLE_SELECTOR = '.note-detail-editable-text-editor'

    this.basePadding = 1.25 // rem
    this.borderWidthPx = 1 // px
    this.borderGap = 0.35 // rem
    this.lineColor = '#444'
    this.lineStepRem = this.borderGap + 1.75

    this.P_PADDING_Y = '0.5rem'
    this.MARK_ATTR = 'data-outline-depth'
    this.STYLE_ID = 'trilium-outline-style'

    // retry 튜닝
    this.RETRY_TRIES = 12 // 재시도 횟수
    this.RETRY_DELAY = 60 // ms

    // 내부 상태
    this._paneRoot = null
    this._obs = null
    this._raf = 0
    this._debounceT = 0
    this._retryTimer = 0

    // 바인딩
    this._onInputCapture = this._onInputCapture.bind(this)
    this._onFocusLike = this._onFocusLike.bind(this)
    this._onMutations = this._onMutations.bind(this)
  }

  doRender() {
    this.$widget = $("<div class='outline-by-heading-widget' style='display:none;'></div>")
  }

  async refreshWithNote(note) {
    // 텍스트 노트만
    if (!note || note.type !== 'text') {
      this.toggleInt(false)
      this._detach()
      return
    }

    // 라벨 기반 활성화
    if (this.ACTIVATE_LABEL && !note.hasLabel(this.ACTIVATE_LABEL)) {
      this.toggleInt(false)
      const pane = this._getPaneRoot()
      if (pane) this._clearOutlineInPane(pane)
      this._detach()
      return
    }

    this.toggleInt(true)

    this._ensureGlobalStyle()

    const paneRoot = this._getPaneRoot()
    this._attach(paneRoot)

    // 초기 렌더 타이밍 이슈 대비: run + retry
    this._scheduleRun({ retry: true })
  }

  cleanup() {
    this._detach()
    super.cleanup()
  }

  // ====== attach / detach ======

  _getPaneRoot() {
    const el = this.$widget?.[0]
    if (!el) return null

    return el.closest('.note-detail-pane') || el.closest('.center-pane') || document
  }

  _attach(paneRoot) {
    if (!paneRoot) return

    if (this._paneRoot !== paneRoot) {
      this._detach()
      this._paneRoot = paneRoot
    }

    if (!this._obs) {
      this._obs = new MutationObserver(this._onMutations)

      // 강화: childList + attributes + characterData
      this._obs.observe(this._paneRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      })

      // 글자 입력뿐 아니라 포커스 또는 클릭에도 적용되게
      this._paneRoot.addEventListener('input', this._onInputCapture, true)
      this._paneRoot.addEventListener('focusin', this._onFocusLike, true)
      this._paneRoot.addEventListener('click', this._onFocusLike, true)
    }
  }

  _detach() {
    if (this._obs) {
      this._obs.disconnect()
      this._obs = null
    }

    if (this._paneRoot) {
      this._paneRoot.removeEventListener('input', this._onInputCapture, true)
      this._paneRoot.removeEventListener('focusin', this._onFocusLike, true)
      this._paneRoot.removeEventListener('click', this._onFocusLike, true)
    }

    this._paneRoot = null

    clearTimeout(this._debounceT)
    clearTimeout(this._retryTimer)
    cancelAnimationFrame(this._raf)

    this._debounceT = 0
    this._retryTimer = 0
    this._raf = 0
  }

  // ====== 이벤트 핸들러 ======

  _onInputCapture(e) {
    const target = e.target
    if (!(target instanceof Node)) return
    if (!target.closest?.(this.EDITABLE_SELECTOR)) return

    // 편집 중: 디바운스
    clearTimeout(this._debounceT)
    this._debounceT = setTimeout(() => this._scheduleRun({ retry: false }), 200)
  }

  _onFocusLike(e) {
    const target = e.target
    if (!(target instanceof Node)) return

    // readonly/editor 주변에서만 반응 (너무 광범위하면 클릭할 때마다 돌 수 있음)
    if (!target.closest?.(this.READONLY_SELECTOR) && !target.closest?.(this.EDITABLE_SELECTOR))
      return

    this._scheduleRun({ retry: true })
  }

  _onMutations(muts) {
    // "addedNodes만" 보지 말고, 변화가 readonly/editor 영역과 관련 있으면 run
    const isRelevant = muts.some((m) => {
      const t = m.target
      const el = t?.nodeType === 1 ? t : t?.nodeType === 3 ? t.parentElement : null

      if (!el) return false

      return (
        el.matches?.(this.READONLY_SELECTOR) ||
        el.matches?.(this.EDITABLE_SELECTOR) ||
        el.closest?.(this.READONLY_SELECTOR) ||
        el.closest?.(this.EDITABLE_SELECTOR) ||
        // CKEditor가 내부를 늦게 채우는 경우 커버
        el.closest?.('.ck-content')
      )
    })

    if (!isRelevant) return

    this._scheduleRun({ retry: true })
  }

  // ====== 스케줄/런/리트라이 ======

  _scheduleRun({ retry }) {
    clearTimeout(this._retryTimer)
    clearTimeout(this._debounceT)
    cancelAnimationFrame(this._raf)

    // 렌더 안정화를 위해 한 프레임 뒤 실행
    this._raf = requestAnimationFrame(() => {
      const applied = this._runOnce()
      if (retry && !applied) {
        this._runWithRetry(this.RETRY_TRIES)
      }
    })
  }

  _runWithRetry(triesLeft) {
    if (triesLeft <= 0) return

    this._retryTimer = setTimeout(() => {
      const applied = this._runOnce()
      if (!applied) this._runWithRetry(triesLeft - 1)
    }, this.RETRY_DELAY)
  }

  _runOnce() {
    if (!this._paneRoot) this._paneRoot = this._getPaneRoot()
    const scope = this._paneRoot || document

    let didApply = false

    const ro = scope.querySelector(this.READONLY_SELECTOR)
    if (ro && !ro.closest('.ck-editor__editable')) {
      this._applyToContainer(ro)
      didApply = true
    }

    const ed = scope.querySelector(this.EDITABLE_SELECTOR)
    if (ed) {
      this._applyToContainer(ed)
      didApply = true
    }

    return didApply
  }

  // ====== 스타일 / 로직 ======

  _ensureGlobalStyle() {
    if (document.getElementById(this.STYLE_ID)) return

    const style = document.createElement('style')
    style.id = this.STYLE_ID
    style.textContent = `
      ${this.READONLY_SELECTOR} p,
      ${this.EDITABLE_SELECTOR} p {
        margin-bottom: unset !important;
        padding-top: ${this.P_PADDING_Y} !important;
        padding-bottom: ${this.P_PADDING_Y} !important;
      }

      ${this.READONLY_SELECTOR} ul,
      ${this.READONLY_SELECTOR} ol,
      ${this.EDITABLE_SELECTOR} ul,
      ${this.EDITABLE_SELECTOR} ol {
        padding-left: unset !important;
        margin-bottom: unset !important;
      }

      [${this.MARK_ATTR}] { position: relative; }

      /* heading 제외한 일반 블록은 ::before로 */
      [${this.MARK_ATTR}]:not(h1):not(h2):not(h3):not(h4):not(h5):not(h6)::before {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;

        left: calc(-1 * var(--outline-indent, 0rem));
        width: var(--outline-gutter, 0rem);

        pointer-events: none;

        background-image: repeating-linear-gradient(
          to right,
          ${this.lineColor} 0 1px,
          transparent 1px var(--outline-step, ${this.lineStepRem}rem)
        );
        background-size: var(--outline-step, ${this.lineStepRem}rem) 100%;
        background-repeat: repeat;
      }

      /* heading의 ::before 충돌 회피 위해 ::after로 */
      h1[${this.MARK_ATTR}],
      h2[${this.MARK_ATTR}],
      h3[${this.MARK_ATTR}],
      h4[${this.MARK_ATTR}],
      h5[${this.MARK_ATTR}],
      h6[${this.MARK_ATTR}] {
        margin-top: 0.1rem !important;
        margin-bottom: 0.1rem !important;
      }
      h1[${this.MARK_ATTR}]::after,
      h2[${this.MARK_ATTR}]::after,
      h3[${this.MARK_ATTR}]::after,
      h4[${this.MARK_ATTR}]::after,
      h5[${this.MARK_ATTR}]::after,
      h6[${this.MARK_ATTR}]::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;

        left: calc(-1 * var(--outline-indent, 0rem));
        width: var(--outline-gutter, 0rem);

        pointer-events: none;

        background-image: repeating-linear-gradient(
          to right,
          ${this.lineColor} 0 1px,
          transparent 1px var(--outline-step, ${this.lineStepRem}rem)
        );
        background-size: var(--outline-step, ${this.lineStepRem}rem) 100%;
        background-repeat: repeat;
      }
      ${this.READONLY_SELECTOR} .table,
      ${this.EDITABLE_SELECTOR} .table {
        margin-top: unset !important;
        margin-bottom: unset !important;
        padding-top: 1rem !important;
        padding-bottom: 1rem !important;
      }
      ${this.READONLY_SELECTOR} .ck-horizontal-line,
      ${this.EDITABLE_SELECTOR} .ck-horizontal-line{
        margin-bottom: unset !important;
        padding: 1rem 0;
      }
      ${this.READONLY_SELECTOR} pre,
      ${this.EDITABLE_SELECTOR} pre {
        margin-bottom: unset;
      }
      h1:not(h1[data-outline-depth]),
      h2:not(h2[data-outline-depth]),
      h3:not(h3[data-outline-depth]),
      h4:not(h4[data-outline-depth]),
      h5:not(h5[data-outline-depth]),
      h6:not(h6[data-outline-depth]) {
        margin-bottom: 0.25rem !important;
      }
      .ck-content ul > li {
        padding-top: 0.25rem;
        /* padding-left: 0.5rem; */
        /* padding-bottom: 0.25rem; */
      }
      .ck-content ol > li {
        padding-top: 0.5rem;
        /* padding-bottom: 0.5rem; */
      }
        
      .ck-content li > ul {
        padding-left: 2rem !important;
      }
      .ck-content h3:has(+ h4) {
        padding-bottom: 0.5rem !important;
      }
      .ck-content blockquote {
          overflow: unset !important;
          margin-bottom: unset !important;
      }
      .ck-content blockquote p {
          margin-left: unset !important;
      }
      @media (prefers-color-scheme: dark) {
          .ck-content blockquote {
              background-color: #292e2d !important;
          }
      }
      .ck-content blockquote:before {
          opacity: unset !important;
          inset-inline-start: calc(-1.01 * var(--outline-indent, 0rem)) !important;
      }
    `
    document.head.appendChild(style)
  }

  _isHeading(el) {
    return el?.tagName && /^H[1-6]$/.test(el.tagName.toUpperCase())
  }

  _getHeadingLevel(h) {
    return Number(h.tagName[1])
  }

  _normalizeParagraphInline(el) {
    if (!el?.tagName) return
    if (el.tagName.toUpperCase() !== 'P') return

    el.style.setProperty('margin-bottom', 'unset', 'important')
    el.style.setProperty('padding-top', this.P_PADDING_Y, 'important')
    el.style.setProperty('padding-bottom', this.P_PADDING_Y, 'important')
  }

  _applyOutlineToEl(el, depth, extraIndent = 0) {
    if (!el) return

    this._normalizeParagraphInline(el)

    if (depth <= 0) {
      el.removeAttribute(this.MARK_ATTR)
      el.style.removeProperty('margin-left')
      el.style.removeProperty('--outline-indent')
      el.style.removeProperty('--outline-gutter')
      el.style.removeProperty('--outline-step')
      return
    }

    const borderWidthRem = this.borderWidthPx * 0.0625
    const indent =
      depth * (this.borderGap + 0.05) +
      depth * borderWidthRem +
      depth * this.basePadding +
      extraIndent

    const gutter = depth * this.lineStepRem

    el.setAttribute(this.MARK_ATTR, String(depth))
    el.style.setProperty('margin-left', `${indent}rem`, 'important')
    el.style.setProperty('--outline-indent', `${indent}rem`)
    el.style.setProperty('--outline-gutter', `${gutter}rem`)
    el.style.setProperty('--outline-step', `${this.lineStepRem}rem`)
  }

  _applyToContainer(container) {
    if (!container) return

    const root = container.matches?.(this.EDITABLE_SELECTOR)
      ? container.querySelector('.ck-content') || container
      : container

    const headings = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    const stack = []

    for (const h of headings) {
      const level = this._getHeadingLevel(h)

      while (stack.length && stack[stack.length - 1] >= level) stack.pop()
      stack.push(level)

      const depth = stack.length

      this._applyOutlineToEl(h, Math.max(depth - 1, 0), 0)

      let el = h.nextElementSibling
      while (el && !this._isHeading(el)) {
        const tag = el.tagName?.toLowerCase?.() ?? ''
        const extra = tag === 'ul' || tag === 'ol' ? 1.25 : 0
        this._applyOutlineToEl(el, depth, extra)
        el = el.nextElementSibling
      }
    }

    for (const p of root.querySelectorAll('p')) {
      this._normalizeParagraphInline(p)
    }
  }

  _clearOutlineInPane(paneRoot) {
    const nodes = paneRoot.querySelectorAll?.(`[${this.MARK_ATTR}]`) || []
    for (const el of nodes) {
      el.removeAttribute(this.MARK_ATTR)
      el.style.removeProperty('margin-left')
      el.style.removeProperty('--outline-indent')
      el.style.removeProperty('--outline-gutter')
      el.style.removeProperty('--outline-step')
    }
  }
}

module.exports = OutlineByHeadingWidget
