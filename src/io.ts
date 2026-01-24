import { vec3 } from './algebra'
import { F32Arr } from './compute'

export function saveBinary(data: ArrayBuffer | Uint32Array, filename: string) {
  const buffer = data instanceof Uint32Array ? data.buffer : data
  let blob = new Blob([buffer as BlobPart], { type: 'octet/stream' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export const openFile = async () => {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.addEventListener('change', () => {
      input.files instanceof FileList ? resolve(input.files[0]) : console.error('No file!')
    })
    input.click()
  })
}

export const readFile = async (call: (data: ArrayBuffer) => void) => {
  const file = (await openFile()) as File
  const reader = new FileReader()
  reader.onload = (evt) => {
    const data = evt.target?.result as ArrayBuffer
    call(data)
  }
  reader.readAsArrayBuffer(file)
}

export function exportSTL(triangleVertices: F32Arr) {
  const triangleCount = triangleVertices.length / 9

  let offset = 80 // skip header
  const buffy = new ArrayBuffer(80 + 4 + triangleCount * 50)
  const output = new DataView(buffy)

  output.setUint32(offset, triangleCount, true)
  offset += 4

  for (let i = 0; i < triangleCount; i++) {
    const a = triangleVertices.slice(9 * i, 9 * i + 3)
    const b = triangleVertices.slice(9 * i + 3, 9 * i + 6)
    const c = triangleVertices.slice(9 * i + 6, 9 * i + 9)

    writeFace(a, b, c)
  }

  saveBinary(buffy, 'deltahedron.stl')

  function writeFace(a: F32Arr, b: F32Arr, c: F32Arr) {
    const normal = vec3.cross(vec3.subtract(b, a), vec3.subtract(c, a))
    vec3.normalize(normal)

    writeVector(normal)
    writeVector(a)
    writeVector(b)
    writeVector(c)
    output.setUint16(offset, 0, true)
    offset += 2
  }

  function writeVector(v: F32Arr) {
    output.setFloat32(offset, v[0], true)
    offset += 4
    output.setFloat32(offset, v[1], true)
    offset += 4
    output.setFloat32(offset, v[2], true)
    offset += 4
  }
}

export const loadFromPublic = async (path: string, call: (data: ArrayBuffer) => void) => {
  try {
    const response = await fetch(path)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.arrayBuffer()
    call(data)
  } catch (e) {
    console.error('Failed to load public file:', e)
  }
}

// test for 3 edges lying in a plane for "the v16"
// unfortunately not
// export function v16_test() {
//   const a = new Float32Array([-0.5011662244796753, 0.2588253319263458, 1.071208119392395])
//   const b = new Float32Array([-0.6148324012756348, 0.40579164028167725, 0.08861913532018661])
//   const c = new Float32Array([-0.10275381803512573, 0.12693250179290771, -0.7237932085990906])
//   const d = new Float32Array([0.7195006012916565, -0.42091307044029236, -0.8779478073120117])

//   const ab = vec3.length(vec3.subtract(a, b))
//   const bc = vec3.length(vec3.subtract(b, c))
//   const cd = vec3.length(vec3.subtract(c, d))

//   console.log(ab - 1, bc - 1, cd - 1) // 1..4e-7

//   const croco = vec3.cross(vec3.subtract(b, c), vec3.subtract(d, c))
//   vec3.normalize(croco)

//   console.log(vec3.dot(croco, vec3.subtract(a, b))) // 0.0132646985  :(
// }
