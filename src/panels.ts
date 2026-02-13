import { BallPark } from './ballPark'
import { enableTooltips, sumFormula, tooltip } from './display'
import { PushButton, SwitchButton } from './ui'

export function createPanels(ballPark: BallPark) {
  const SHORT_WINDOW_HEIGHT = 400

  // structure ____________________________________________

  const structureButton = (name: string, path: string, f?: () => void) => {
    const butt = new PushButton(name)
    butt.button.className = 'structureButton'
    butt.button.style.width = '250px'
    butt.onPush(() => {
      if (f == undefined) ballPark.loadDataFile(path)
      else f()
    })
    Panel.latest.div.appendChild(butt.button)
    return butt.button
  }

  //
  //
  //
  new Panel('library')

  //
  title('Platonic solids')

  structureButton(`tetrahedron (${sumFormula('Y4')})`, '', () => ballPark.loadTetrahedron())
  structureButton(`octahedron (${sumFormula('T6')})`, '', () => ballPark.loadOctahedron())
  structureButton(`icosahedron (${sumFormula('P12')})`, '/basic/icosahedron')

  //
  title('Lobel structures')

  structureButton(`triangle V26 (${sumFormula('T6H20')})`, '/Lobel/triangle_V26')
  structureButton(`triangle V74 (${sumFormula('T6H68')})`, '/Lobel/triangle_V74')

  //
  title('notable')
  const bistableButt = structureButton(`bistable (${sumFormula('T8S4')})`, '/V12/T8S4')
  tooltip(
    bistableButt,
    -270,
    0,
    250,
    'This structure has two distinct non-intersecting solutions. Try to find the second one by carefully applying the attractive force.'
  )
  structureButton(`propeller (${sumFormula('T9S6')})`, '/V15/T9S6_propeller')
  const fivefoldButt = structureButton(
    `fivefold inward (${sumFormula('P12H10')})`,
    '/V22/P12H10_fivefold_in'
  )
  tooltip(
    fivefoldButt,
    -200,
    0,
    180,
    'Set force to zero before loading it to see the inward facing solution.'
  )
  structureButton(`the X (${sumFormula('T12H24S4O4')})`, '/V44/X')

  //
  const toroids = title('toroids')
  tooltip(toroids, -10, -12, 100, 'structures with one hole')

  structureButton(`Conway's (${sumFormula('T3P9O3N3')})`, '/toroids/conways')
  structureButton(`Stewart (${sumFormula('T6H12O6')})`, '/toroids/stewart')
  structureButton(`Stewart extended (${sumFormula('T6H24O6')})`, '/toroids/stewart_extended')
  structureButton(`trigonal (${sumFormula('T3H18O3')})`, '/toroids/trigonal')
  structureButton(`tetragonal (${sumFormula('T4H24O4')})`, '/toroids/tetragonal')
  structureButton(`pentagonal (${sumFormula('T5H30O5')})`, '/toroids/pentagonal')
  structureButton(`hexagonal* (${sumFormula('T6H36O6')})`, '/toroids/hexagonal_flat')
  structureButton(`octagonal (${sumFormula('P8H36O4')})`, '', () => ballPark.loadTorus())

  //
  title('curiosities')

  const v12aButt = structureButton(
    `V12 not converging (${sumFormula('T4P5H2S1')})`,
    '/not_converging/V12a'
  )
  tooltip(v12aButt, -250, 0, 230, 'This structure seems to have no solution even though E=3V-6.')

  //
  //
  //
  const dataPanel = new Panel('data', SHORT_WINDOW_HEIGHT)

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
  const viewPanel = new Panel('view', SHORT_WINDOW_HEIGHT)

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
  const settingsPanel = new Panel('settings', SHORT_WINDOW_HEIGHT)

  const allowTetrahedraButton = new SwitchButton('allow tetrahedra')
  allowTetrahedraButton.onPush(() => ballPark.setAllowTetrahedra(allowTetrahedraButton.on))
  tooltip(
    allowTetrahedraButton.button,
    -320,
    0,
    300,
    'Tetrahedra are rather inconsequential for a deltahedron since they are only sitting on top of a triangular face without influencing the rest of the structure and can therefore be considered as separable compounds. You may wish to not allow the creation of tetrahedra for clarity.'
  )
  allowTetrahedraButton.click()

  const mouseSignalOnReleaseButton = new SwitchButton('trigger on mouse release')
  mouseSignalOnReleaseButton.onPush(() =>
    ballPark.setMouseSignalOnRelease(mouseSignalOnReleaseButton.on)
  )
  tooltip(
    mouseSignalOnReleaseButton.button,
    -200,
    0,
    180,
    'Edge operations will only be triggered once the mouse button is released (and not on push).'
  )

  settingsPanel.div.appendChild(allowTetrahedraButton.button)
  settingsPanel.div.appendChild(mouseSignalOnReleaseButton.button)

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
    'Create the augmented dodecahedron called "goal" from the "start" structure below. You may only use the flip operation.'
  )
  structureButton(`goal (${sumFormula('P12H20')})`, '/V22/dodeca')
  structureButton(`start (${sumFormula('P12H20')})`, '/V22/dodeca_puzzle')

  //
  //
  //
  new Panel('info')

  text(
    'With this interactive application you can explore the world of deltahedra, which are polyhedra made only from equilateral triangles. In the upper left corner you can find the three basic operations which will be performed if you click on an edge with the mouse. Almost all interactive elements and info panels show information tooltips if the mouse hovers over them.'
  )
  text(
    'If a certain structure can truly converge to a deltahedron (maximum distance error = 0, also called a "solution") depends on several things. First of all, the force slider needs to be at zero which means that there is no repulsive or attractive force between the vertices. Second, there might be more edge constraints than can be satisfied at the same time. This happens when E>3V-6, where E and V are the number of edges and vertices, respectively. This condition is always met for toroidal deltahedra (wich have one hole, also called genus 1 surfaces). That is why most toroids do not converge but in the library you can find some which still do because of their symmetries.'
  )
  // But even for deltahedra without a hole (genus 0 surfaces) there might be no solution for a certain connectivity (one example you can find in the library under "curiosities").
  text(
    'Using the force slider to create an attractive force only for a moment and then setting it to zero again, you can find other solutions for the same connectivity.'
  )
  text(
    'Sometimes, especially if you apply an attractive force, structures can self-intersect. The algorithm does not prevent this, it only tries to bring all edge lengths to unity (a "solution"). Typically, there are more self-intersecting solutions than regular ones.'
  )
  text(
    'If you have questions or comments feel free to <a href="https://formaldesign.net/contact" target="_blank">get in touch</a>.'
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
