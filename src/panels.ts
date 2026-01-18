import { BallPark } from './ballPark'
import { sumFormula, tooltip } from './display'
import { PushButton, SwitchButton } from './ui'

export function createPanels(ballPark: BallPark) {
  // structure ____________________________________________

  const structureButton = (name: string, path: string, f?: () => void) => {
    const butt = new PushButton(name)
    butt.button.className = 'structureButton'
    butt.onPush(() => {
      if (f == undefined) ballPark.loadDataFile(path)
      else f()
    })
    createPanel.div.appendChild(butt.button)
  }

  const createPanel = new Panel('create')

  //
  text('Platonic solids', createPanel.div, '16px')

  structureButton(`octahedron (${sumFormula('T6')})`, '', () => ballPark.loadOctahedron())
  structureButton(`icosahedron (${sumFormula('P12')})`, '/basic/icosahedron')

  //
  text('Lobel structures', createPanel.div, '16px')

  structureButton(`triangle V26 (${sumFormula('T6H20')})`, '/Lobel/triangle_V26')
  structureButton(`triangle V74 (${sumFormula('T6H68')})`, '/Lobel/triangle_V74')

  //
  text('toroids', createPanel.div, '16px')

  structureButton(`Conway's (${sumFormula('T3P9O3N3')})`, '/toroids/conways')
  structureButton(`trigonal (${sumFormula('T3H18O3')})`, '/toroids/trigonal')
  structureButton(`tetragonal (${sumFormula('T4H24O4')})`, '/toroids/tetragonal')
  structureButton(`pentagonal (${sumFormula('T5H30O5')})`, '/toroids/pentagonal')
  structureButton(`hexagonal* (${sumFormula('T6H36O6')})`, '/toroids/hexagonal_flat')
  structureButton(`octagonal (${sumFormula('P8H36O4')})`, '', () => ballPark.loadTorus())

  //
  //
  //
  // data _________________________________________________
  const dataPanel = new Panel('data')

  const loadButton = new PushButton('load')
  loadButton.onPush(async () => await ballPark.loadData())
  dataPanel.div.appendChild(loadButton.button)

  const saveButton = new PushButton('save')
  saveButton.onPush(async () => await ballPark.saveData())
  dataPanel.div.appendChild(saveButton.button)

  const exportSTLButton = new PushButton('export STL')
  exportSTLButton.onPush(async () => await ballPark.exportSTL())
  dataPanel.div.appendChild(exportSTLButton.button)

  // const eraseAllButton = new PushButton('erase all')
  // eraseAllButton.onPush(() => {
  //   // if(confirm('Are you sure you want to erase this structure? If not you should save it first.'))
  //   ballPark.loadOctahedron()
  // })
  // dataPanel.div.appendChild(eraseAllButton.button)

  //
  //
  //
  // view _________________________________________________
  const viewPanel = new Panel('view')

  const faceButton = new SwitchButton('faces')
  faceButton.onPush(() => ballPark.showFaces(faceButton.on))

  const rodButton = new SwitchButton('edges')
  rodButton.onPush(() => ballPark.showRods(rodButton.on))

  const ballButton = new SwitchButton('vertices')
  ballButton.onPush(() => ballPark.showBalls(ballButton.on))

  const showOnlyIsoRodsButton = new SwitchButton('only iso edges')
  showOnlyIsoRodsButton.onPush(() => ballPark.setShowOnlyIsoRods(showOnlyIsoRodsButton.on))
  tooltip(
    showOnlyIsoRodsButton.button,
    -220,
    0,
    210,
    'Shows only edges which are connecting vertices with the same coordination number.'
  )

  const rotateButton = new SwitchButton('rotate')
  rotateButton.onPush(() => ballPark.setRotation(rotateButton.on))

  viewPanel.div.appendChild(faceButton.button)
  viewPanel.div.appendChild(rodButton.button)
  viewPanel.div.appendChild(ballButton.button)
  viewPanel.div.appendChild(showOnlyIsoRodsButton.button)
  viewPanel.div.appendChild(rotateButton.button)

  // show stuff
  faceButton.click()
  rodButton.click()
  ballButton.click()
}

class Panel {
  div: HTMLDivElement
  button: HTMLButtonElement

  // distance of initial button and all panels from top of the page in px
  private static readonly TOP = 100
  // dynamically updated length for the top of the next button
  private static buttonTop = this.TOP
  // track the currently open panel
  private static activePanel: Panel | null = null

  constructor(name: string) {
    // Initialize Global Listener (Runs once on first instantiation)
    if (Panel.buttonTop === Panel.TOP) {
      window.addEventListener('pointerdown', (e) => {
        const target = e.target as HTMLElement
        // If no panel is active, do nothing
        if (!Panel.activePanel) return

        // If clicked inside the active panel, do nothing (allow interaction)
        if (Panel.activePanel.div.contains(target)) return

        // If clicked on ANY vertical button, do nothing here.
        // We let the button's specific click handler manage the switch/toggle.
        // This prevents race conditions and the "flash" effect.
        if (target.closest('.verticalButton')) return

        // Otherwise (clicked outside panel AND outside buttons), close it.
        Panel.closeActive()
      })
    }

    // DOM Creation
    const height = (name.length + 1) * 10

    this.div = document.createElement('div')
    this.div.className = 'panel'
    this.div.style.top = String(Panel.TOP) + 'px'
    document.body.appendChild(this.div)

    this.button = document.createElement('button')
    this.button.className = 'verticalButton'
    this.button.classList.add('switchButtonOff')
    this.button.style.top = String(Panel.buttonTop) + 'px'
    this.button.style.height = String(height) + 'px'
    document.body.appendChild(this.button)

    const buttonText = document.createElement('span')
    buttonText.innerHTML = name
    this.button.appendChild(buttonText)

    Panel.buttonTop += height + 10

    // Button Interaction Logic
    this.button.addEventListener('click', () => {
      if (Panel.activePanel === this) Panel.closeActive()
      else {
        Panel.closeActive()
        this.open()
      }
    })
  }

  // Opens this specific instance
  private open() {
    Panel.activePanel = this
    this.div.style.visibility = 'visible'
    this.button.classList.replace('switchButtonOff', 'switchButtonOn')
  }

  // Closes whatever is currently open
  private static closeActive() {
    if (Panel.activePanel) {
      Panel.activePanel.div.style.visibility = 'hidden'
      Panel.activePanel.button.classList.replace('switchButtonOn', 'switchButtonOff')
      Panel.activePanel = null
    }
  }
}

function text(
  content: string,
  parent: HTMLElement,
  fontSize?: string,
  color?: string
): HTMLParagraphElement {
  const text = document.createElement('p')
  text.innerHTML = content
  if (fontSize !== undefined) text.style.fontSize = fontSize
  if (color !== undefined) text.style.color = color
  text.style.paddingTop = '20px'
  parent.appendChild(text)
  return text
}
