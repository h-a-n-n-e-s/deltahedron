import { U32Arr } from './compute'
import { PushButton } from './ui'

const color = {
  pink: [1, 0.6, 0.6],
  blue: [0.3, 0, 0.9],
  cyan: [0, 0.6, 0.6],
  white: [0.9, 0.9, 0.9],
  red: [0.9, 0, 0],
  yellow: [1, 0.9, 0],
  green: [0, 0.7, 0],
  magenta: [0.8, 0, 0.8],
  coal: [0.3, 0.3, 0.3],
}
export const colorArray = Object.values(color).map((c) => c)

let tooltipsEnabled = true
export const enableTooltips = (state: boolean) => {
  tooltipsEnabled = state
}

export class Info {
  div: HTMLDivElement
  span: HTMLSpanElement

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
}

export const tooltip = (
  element: HTMLElement,
  x: number, // offset in x
  y: number, // offset in y
  width: number,
  text: string
) => {
  const tt = document.body.appendChild(document.createElement('div'))
  tt.className = 'tooltip'
  tt.style.width = `${width}px`
  tt.innerHTML = text

  // we use explicit event listeners instead of simple css
  // to avoid problems with tt clipping in the panel etc.
  element.addEventListener('mouseenter', () => {
    if (!tooltipsEnabled) return

    const rect = element.getBoundingClientRect()
    const top = rect.top + window.scrollY
    const left = rect.left + window.scrollX

    tt.style.top = `${top - y}px`
    tt.style.left = `${left + x}px`
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
  const element = ['Y', 'T', 'P', 'H', 'S', 'O', 'N', 'D']
  let bigCount = 0
  let string = ''
  for (let i = 3; i < 12; i++) {
    const c = colorU8Array[i - 3]
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
          element[i - 3] +
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
  const formula = new Uint32Array(12)

  const mapping: Record<string, number> = {
    Y: 3,
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
      formula[mapping[letter]] = parseInt(value, 10)
    }
  }

  return vertexCountToSummationFormula(formula)
}

export const createOverlay = (message: string, id?: string) => {
  const globalOverlay = document.createElement('div')
  globalOverlay.className = 'globalOverlay'
  if (id) globalOverlay.id = id
  document.body.appendChild(globalOverlay)
  const subdividingInfo = document.createElement('p')
  subdividingInfo.innerHTML = message
  globalOverlay.appendChild(subdividingInfo)

  return globalOverlay
}

export const checkBrowserSupport = async (): Promise<boolean> => {
  let message = ''

  const ua = navigator.userAgent.toLowerCase()

  const isFirefox = ua.includes('firefox')
  const isSafari = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('android')

  // Check for WebGPU specifically (even if the browser claims support, the object might be missing)
  const hasWebGPU = 'gpu' in navigator

  if (isFirefox) {
    message =
      "Firefox's WebGPU implementation is currently unstable. Please use Chrome, Edge, or Opera."
  } else if (isSafari) {
    message = "Safari's WebGPU support is currently unstable. Please use Chrome, Edge, or Opera."
  } else if (!hasWebGPU) {
    message =
      'Your browser does not support WebGPU. This app requires a Chromium-based browser (Chrome, Edge, Opera).'
  } else {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })

    const info = adapter ? adapter.info : undefined

    let optimal = false

    if (info) {
      if (ua.includes('mac')) {
        // Optimal if it's not a generic fallback and mentions Apple/Metal
        optimal = info.description.includes('apple') || info.architecture.includes('metal')
      } else if (ua.includes('linux')) {
        // if Vulkan isn't in the description it's likely the slow GL fallback
        optimal = info.description.toLowerCase().includes('vulkan')
      } else if (ua.includes('win')) {
        // Check for D3D12 signature (Chrome's preferred Windows backend)
        optimal = info.description.includes('Direct3D 12')
      }
      if (!optimal)
        message = `Your browser's GPU hardware acceleration is not set up optimally to use WebGPU. The user experience will likely be disappointing.`
    } else message = `Your browser does not support WebGPU.`
  }

  if (message !== '') {
    const overlay = createOverlay(message)
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'
    overlay.style.display = 'flex'
    showWarningBanner(overlay)
    return false
  }

  return true
}

const showWarningBanner = (overlay: HTMLDivElement) => {
  const dismissButton = new PushButton('dismiss', false)
  dismissButton.onPush(() => {
    overlay.style.display = 'none'
  })
  overlay.appendChild(dismissButton.button)
}
