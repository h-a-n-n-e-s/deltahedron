import { BallPark } from './ballPark'
import { enableTooltips, sumFormula, tooltip } from './display'
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
    Panel.latest.div.appendChild(butt.button)
  }

  //
  //
  //
  new Panel('create')

  //
  title('Platonic solids')

  structureButton(`octahedron (${sumFormula('T6')})`, '', () => ballPark.loadOctahedron())
  structureButton(`icosahedron (${sumFormula('P12')})`, '/basic/icosahedron')

  //
  title('Lobel structures')

  structureButton(`triangle V26 (${sumFormula('T6H20')})`, '/Lobel/triangle_V26')
  structureButton(`triangle V74 (${sumFormula('T6H68')})`, '/Lobel/triangle_V74')

  //
  const toroids = title('toroids')
  tooltip(toroids, -10, -22, 100, 'structures with one hole')

  structureButton(`Conway's (${sumFormula('T3P9O3N3')})`, '/toroids/conways')
  structureButton(`Stewart (${sumFormula('T6H12O6')})`, '/toroids/stewart')
  structureButton(`trigonal (${sumFormula('T3H18O3')})`, '/toroids/trigonal')
  structureButton(`tetragonal (${sumFormula('T4H24O4')})`, '/toroids/tetragonal')
  structureButton(`pentagonal (${sumFormula('T5H30O5')})`, '/toroids/pentagonal')
  structureButton(`hexagonal* (${sumFormula('T6H36O6')})`, '/toroids/hexagonal_flat')
  structureButton(`octagonal (${sumFormula('P8H36O4')})`, '', () => ballPark.loadTorus())

  //
  //
  //
  const dataPanel = new Panel('data', 320)

  const loadButton = new PushButton('load')
  loadButton.onPush(async () => await ballPark.loadData())
  dataPanel.div.appendChild(loadButton.button)
  tooltip(loadButton.button, -150, 0, 130, 'Load a structure previously saved.')

  const saveButton = new PushButton('save')
  saveButton.onPush(async () => await ballPark.saveData())
  dataPanel.div.appendChild(saveButton.button)
  tooltip(saveButton.button, -190, 0, 170, 'Save current structure in Downloads.')

  const exportSTLButton = new PushButton('export STL')
  exportSTLButton.onPush(async () => await ballPark.exportSTL())
  dataPanel.div.appendChild(exportSTLButton.button)
  tooltip(
    exportSTLButton.button,
    -190,
    0,
    170,
    'Save an .stl file of the current structure in Downloads.'
  )

  //
  //
  //
  const viewPanel = new Panel('view', 320)

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
    -230,
    0,
    210,
    'Shows only edges which are connecting vertices with the same valence.'
  )

  const rotateButton = new SwitchButton('rotate')
  rotateButton.onPush(() => ballPark.setRotation(rotateButton.on))
  tooltip(
    rotateButton.button,
    -230,
    0,
    210,
    'The structure will continue rotating in the direction you rotate it with the mouse. The rotation speed depends on the speed of the mouse action.'
  )

  const showTooltipsButton = new SwitchButton('show tooltips')
  showTooltipsButton.onPush(() => enableTooltips(showTooltipsButton.on))
  showTooltipsButton.click()

  viewPanel.div.appendChild(faceButton.button)
  viewPanel.div.appendChild(rodButton.button)
  viewPanel.div.appendChild(ballButton.button)
  viewPanel.div.appendChild(showOnlyIsoRodsButton.button)
  viewPanel.div.appendChild(rotateButton.button)
  viewPanel.div.appendChild(showTooltipsButton.button)

  // show stuff
  faceButton.click()
  rodButton.click()
  ballButton.click()

  //
  //
  //
  new Panel('game')

  title('simple game')
  text(
    'Create an icosahedron from the octahedron below while only using the add and flip operation. You may use the flip operation only once.'
  )
  structureButton(`octahedron (${sumFormula('T6')})`, '', () => ballPark.loadOctahedron())

  title('advanced game')
  text(
    'Create the augmented dodecahedron called "goal" from the "messy" structure below. You may only use the flip operation.'
  )
  structureButton(`goal (${sumFormula('P12H20')})`, '/V22/dodeca')
  structureButton(`messy (${sumFormula('P12H20')})`, '/V22/dodeca_puzzle')

  //
  //
  //
  new Panel('info')

  title('about')
  text(
    'With this interactive application you can explore the world of deltahedra, polyhedra made only of equilateral triangles. In the upper left corner you will find the three basic operations which will be performed if you click on an edge with the mouse. Almost all interactive elements and info panels show information tooltips if you hover over them with the mouse.'
  )
  text(
    'If a certain structure can truly converge to a deltahedron (maximum distance error = 0) depends on... finding other equil... the force...'
  )
}

class Panel {
  div: HTMLDivElement
  button: HTMLButtonElement

  static latest: Panel

  // distance of initial button and all panels from top of the page in px
  private static readonly TOP = 42
  // dynamically updated length for the top of the next button
  private static buttonTop = this.TOP
  // track the currently open panel
  private static activePanel: Panel | null = null

  constructor(name: string, panelHeight?: number) {
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
    if (panelHeight) this.div.style.height = `${panelHeight}px`
    document.body.appendChild(this.div)
    Panel.latest = this

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

function text(content: string, color?: string): HTMLParagraphElement {
  const text = document.createElement('p')
  text.innerHTML = content
  if (color !== undefined) text.style.color = color
  text.className = 'panelText'
  text.style.paddingTop = '20px'
  Panel.latest.div.appendChild(text)
  return text
}

function title(content: string): HTMLParagraphElement {
  const title = document.createElement('p')
  title.innerHTML = content
  title.className = 'panelTitle'
  title.style.paddingTop = '20px'
  Panel.latest.div.appendChild(title)
  return title
}
