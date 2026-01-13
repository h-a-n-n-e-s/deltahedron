import { BallPark } from './ballPark'
import { PushButton } from './ui'

export function createPanels(ballPark: BallPark) {
  const dataPanel = new Panel('data')

  const loadButton = new PushButton('load')
  loadButton.onPush(async () => ballPark.loadData())
  dataPanel.div.appendChild(loadButton.button)

  const saveButton = new PushButton('save')
  saveButton.onPush(async () => await ballPark.saveData())
  dataPanel.div.appendChild(saveButton.button)

  const exportSTLButton = new PushButton('export STL')
  exportSTLButton.onPush(async () => await ballPark.exportSTL())
  dataPanel.div.appendChild(exportSTLButton.button)

  const eraseAllButton = new PushButton('erase all')
  eraseAllButton.onPush(() => {
    // if(confirm('Are you sure you want to erase this structure? If not you should save it first.'))
    ballPark.loadOctahedron()
  })
  dataPanel.div.appendChild(eraseAllButton.button)
}

class Panel {
  div: HTMLDivElement
  button: HTMLButtonElement

  private static top = 100 // distance of initial button from top of the page in px

  private static visiblePanel: { exist: boolean; panel: Panel }

  private on: boolean = false // button state
  private buttonText: HTMLSpanElement

  constructor(name: string) {
    // calculate button height from string length (monospace 10px/character)
    const height = (name.length + 1) * 10

    this.div = document.createElement('div')
    this.div.className = 'panel'
    this.div.style.top = String(Panel.top) + 'px'
    document.body.appendChild(this.div)

    this.button = document.createElement('button')
    this.button.className = 'verticalButton'
    this.button.classList.add('switchButtonOff')
    this.button.style.top = String(Panel.top) + 'px'
    this.button.style.height = String(height) + 'px'
    document.body.appendChild(this.button)

    this.buttonText = document.createElement('span')
    this.buttonText.innerHTML = name
    this.button.appendChild(this.buttonText)

    Panel.top += height + 10 // top position of next button

    this.button.addEventListener(
      'click',
      () => {
        this.on = !this.on

        const visPan = Panel.visiblePanel
        if (visPan !== undefined) {
          if (visPan.exist) {
            visPan.panel.div.style.visibility = 'hidden'
            visPan.panel.button.classList.replace('switchButtonOn', 'switchButtonOff')
            visPan.panel.on = false
            visPan.exist = false
          }
        }

        if (this.on) {
          Panel.visiblePanel = { exist: true, panel: this }
          this.div.style.visibility = 'visible'
          this.button.classList.replace('switchButtonOff', 'switchButtonOn')
        }
      },
      false
    )
  }

  clear = () => {
    // for (const c of this.div.childNodes) c.remove();
    while (this.div.firstChild) this.div.removeChild(this.div.lastChild!)
  }
}
