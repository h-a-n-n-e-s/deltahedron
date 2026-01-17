import { U32Arr } from './compute'

const color = {
  blue: [0.2, 0, 0.8],
  cyan: [0, 0.6, 0.6],
  white: [0.9, 0.9, 0.9],
  red: [0.9, 0, 0],
  yellow: [1, 0.9, 0],
  green: [0, 0.7, 0],
  magenta: [0.8, 0, 0.8],
  coal: [0.3, 0.3, 0.3],
}
export const colorArray = Object.values(color).map((c) => c)

export class Info {
  div: HTMLDivElement
  span: HTMLSpanElement
  toolTip!: HTMLDivElement

  set!: () => string

  constructor(id: string) {
    this.div = document.createElement('div')
    this.div.id = id
    document.body.appendChild(this.div)

    this.span = document.createElement('span')
    this.div.appendChild(this.span)
  }

  update = () => {
    if (this.set !== undefined) if (this.set.length == 0) this.span.innerHTML = this.set()
  }

  createTooltip = (top: string, right: string, width: string, text: string) => {
    this.toolTip = this.div.appendChild(document.createElement('div'))
    this.toolTip.className = 'infoTooltip'
    this.toolTip.style.top = top
    this.toolTip.style.right = right
    this.toolTip.style.width = width
    this.toolTip.innerHTML = text
  }
}

export const tooltip = (
  element: HTMLElement,
  y: number, // offset in y
  x: number, // offset in x
  width: number,
  text: string
) => {
  const tt = document.body.appendChild(document.createElement('div'))
  tt.className = 'tooltip'
  tt.style.width = `${width}px`
  tt.innerHTML = text

  element.addEventListener('mouseenter', () => {
    const rect = element.getBoundingClientRect()

    // The reliable absolute calculation
    const top = rect.top + window.scrollY
    const left = rect.left + window.scrollX

    // Position it above the button and centered
    tt.style.top = `${top - x}px`
    tt.style.left = `${left + y}px`
    tt.style.visibility = 'visible'
    tt.style.opacity = '1'
  })

  element.addEventListener('mouseleave', () => {
    tt.style.visibility = 'hidden'
    tt.style.opacity = '0'
  })
}

export class ActivityIndicator {
  private div: HTMLDivElement

  constructor() {
    this.div = document.createElement('div')
    this.div.id = 'activityIndicator'
    document.body.appendChild(this.div)
  }

  run = () => (this.div.innerHTML = '.')
  stop = () => (this.div.innerHTML = '')
}

const colorU8Array = Object.values(color).map((c) => c.map((v) => Math.floor(255 * v)))

export const vertexCountToSummationFormula = (count: U32Arr) => {
  const element = ['T', 'P', 'H', 'S', 'O', 'N', 'D']
  let bigCount = 0
  let string = ''
  for (let i = 4; i < 12; i++) {
    const c = colorU8Array[i - 4]
    if (i > 10 && count[i] > 0) bigCount += count[i]
    else if (count[i] > 0) {
      string = string.concat(
        '<span style="color:rgb(' +
          c[0] +
          ',' +
          c[1] +
          ',' +
          c[2] +
          ')">' +
          element[i - 4] +
          '<sub>' +
          count[i] +
          '</sub>&emsp14;</span>'
      )
    }
    if (i == 11 && bigCount > 0)
      string = string.concat(
        '<span style="color:rgb(' +
          c[0] +
          ',' +
          c[1] +
          ',' +
          c[2] +
          ')">' +
          'B' +
          '<sub>' +
          bigCount +
          '</sub>&emsp14;</span>'
      )
  }
  return string
}

export const sumFormula = (s: string) => {
  const out = new Uint32Array(12)

  const mapping: Record<string, number> = {
    T: 4,
    P: 5,
    H: 6,
    S: 7,
    O: 8,
    N: 9,
    D: 10,
  }

  // Regex: Find a letter ([A-Z]) followed by one or more digits (\d+)
  const matches = s.matchAll(/([A-Z])(\d+)/g)

  for (const [_, letter, value] of matches) {
    if (mapping[letter] !== undefined) {
      out[mapping[letter]] = parseInt(value, 10)
    }
  }

  return vertexCountToSummationFormula(out)
}
