import { F32Arr, U32Arr } from './compute'

export type Mesh = {
  vertices: F32Arr
  normals: F32Arr
  indices: U32Arr
}

export type MeshBuffers = {
  vertexBuffer: GPUBuffer
  normalBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  tangentBuffer?: GPUBuffer
}

export function getMeshBuffers(device: GPUDevice, mesh: Mesh): MeshBuffers {
  const vertexData = mesh.vertices
  const normalData = mesh.normals
  const indexData = mesh.indices

  const vertexBuffer = device.createBuffer({
    label: 'vertex',
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(vertexBuffer, 0, vertexData)

  const normalBuffer = device.createBuffer({
    label: 'normal',
    size: normalData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(normalBuffer, 0, normalData)

  const indexBuffer = device.createBuffer({
    label: 'index',
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(indexBuffer, 0, indexData)

  return { vertexBuffer: vertexBuffer, normalBuffer: normalBuffer, indexBuffer: indexBuffer }
}

// simple cube for line-list drawing
export const cubeLineVertices = new Float32Array([
  -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, -1, 1,
])
export const cubeLineIndices = new Uint32Array([
  0, 1, 1, 2, 2, 3, 3, 0, 0, 4, 1, 5, 2, 6, 3, 7, 4, 5, 5, 6, 6, 7, 7, 4,
])
// export const cubeTriangleIndices = new Uint32Array([0,1,2, 0,2,3, 0,4,1, 1,4,5, 1,5,6, 1,6,2, 2,6,7, 2,7,3, 0,3,7, 0,7,4, 4,6,5, 4,7,6]);

// cube with 3 distinct normals per vertex
export const cubeVertices = new Float32Array([
  -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1, 1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1,
  -1, -1, 1, 1, -1, 1, 1, -1, -1, -1, 1, -1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, -1, 1,
  1, -1, 1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, -1, 1,
])
export const cubeNormals = new Float32Array([
  -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, -1, 0, 0, -1, 0, 0,
  -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
])
export const cubeIndices = new Uint32Array([
  0, 1, 2, 0, 2, 3, 4, 7, 5, 5, 7, 6, 8, 10, 9, 8, 11, 10, 12, 13, 15, 13, 14, 15, 16, 17, 18, 16,
  18, 19, 20, 23, 21, 21, 23, 22,
])

// icosahedron with vertices on the unit sphere
const u = Math.sqrt(2 / (5 + Math.sqrt(5)))
const g = (u * (1 + Math.sqrt(5))) / 2
export const icosahedronVertices = new Float32Array([
  0,
  -u,
  -g,
  -u,
  -g,
  0,
  -g,
  0,
  -u,

  0,
  u,
  -g,
  u,
  -g,
  0,
  -g,
  0,
  u,

  0,
  -u,
  g,
  -u,
  g,
  0,
  g,
  0,
  -u,

  0,
  u,
  g,
  u,
  g,
  0,
  g,
  0,
  u,
])
export const icosahedronIndices = new Uint32Array([
  0, 1, 2, 0, 2, 3, 0, 3, 8, 0, 4, 1, 0, 8, 4, 1, 4, 6, 1, 6, 5, 1, 5, 2, 2, 7, 3, 2, 5, 7, 3, 7,
  10, 3, 10, 8, 4, 11, 6, 4, 8, 11, 5, 6, 9, 5, 9, 7, 6, 11, 9, 7, 9, 10, 8, 10, 11, 9, 11, 10,
])
export const icosahedronLineIndices = new Uint32Array([
  0, 1, 0, 2, 0, 3, 0, 4, 0, 8, 1, 2, 1, 4, 1, 5, 1, 6, 2, 3, 2, 5, 2, 7, 3, 7, 3, 8, 3, 10, 4, 6,
  4, 8, 4, 11, 5, 6, 5, 7, 5, 9, 6, 9, 6, 11, 7, 9, 7, 10, 8, 10, 8, 11, 9, 10, 9, 11, 10, 11,
])

export function icoSphereMesh(radius: number, refinementLevel: number): Mesh {
  const [norm, ind] = icoSphere(refinementLevel)

  const vert = norm.map((v) => v * radius)

  return { vertices: vert, normals: norm, indices: ind }
}

// refined icosahedron to approximate a unit sphere
function icoSphere(refinementLevel: number): [F32Arr, U32Arr] {
  if (refinementLevel > 1) {
    const [vert, ind] = icoSphere(refinementLevel - 1) // recursive call

    const triangleCount = ind.length / 3
    let vertexCount = vert.length / 3

    const vertNew = new Float32Array(3 * (vertexCount + (3 / 2) * triangleCount)) // current vertices plus a new vertex on every edge
    const indNew = new Uint32Array(12 * triangleCount) // 4 times as many as previous level

    vertNew.set(vert) // insert already existing vertices

    let pairs = new Map()

    // iterate over all triangles
    for (let t = 0; t < triangleCount; t++) {
      const addedIndices = []

      for (let k = 0; k < 3; k++) {
        // get triangle indices
        const i = ind[3 * t + k]
        const j = ind[3 * t + ((k + 1) % 3)]

        // every edge pair appears twice when iterating over triangles
        // so we keep track of edge pairs to not add a vertex twice

        // unique identifier for pair i,j using the Cantor pairing function
        const pairId = ((i + j) * (i + j + 1)) / 2 + j

        if (!pairs.has(pairId)) {
          // first time a pair is visited

          // add pairing(j,i) since only this reverse one will appear again
          pairs.set(pairId - j + i, vertexCount)

          // add index for new vertex
          addedIndices.push(vertexCount)

          const cc = 3 * vertexCount // coordinate count

          // create new vertex
          for (let o = 0; o < 3; o++) vertNew[cc + o] = vert[3 * i + o] + vert[3 * j + o]

          const norm = Math.sqrt(vertNew[cc] ** 2 + vertNew[cc + 1] ** 2 + vertNew[cc + 2] ** 2)

          for (let o = 0; o < 3; o++) vertNew[cc + o] /= norm

          vertexCount++
        } else {
          // second time a pair is visited

          addedIndices.push(pairs.get(pairId))
          pairs.delete(pairId) // pairs only appear twice
        }
      }

      // indices for 3 corner triangles
      for (let k = 0; k < 3; k++)
        indNew.set([ind[3 * t + k], addedIndices[k], addedIndices[(k + 2) % 3]], 12 * t + 3 * k)

      // indices for central triangle
      indNew.set(addedIndices, 12 * t + 9)
    }

    return [vertNew, indNew]
  } else return [icosahedronVertices, icosahedronIndices]
}

// cylinder
export function cylinderMesh(tesselation: number, r: number, h: number, caps = false): Mesh {
  let m = 1
  if (caps) m = 2

  const v = new Float32Array(6 * tesselation * m + 6 * (m - 1))
  const n = new Float32Array(6 * tesselation * m)
  const f = new Uint32Array(6 * tesselation * m)

  // cap midpoints
  if (caps) {
    v.set([0, -h, 0], 6 * tesselation)
    v.set([0, h, 0], 6 * tesselation + 3)
  }

  for (let i = 0; i < tesselation; i++) {
    const angle = (2 * i * Math.PI) / tesselation
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    v.set([r * c, -h, r * s], 6 * i)
    v.set([r * c, h, r * s], 6 * i + 3)
    n.set([c, 0, s], 6 * i)
    n.set([c, 0, s], 6 * i + 3)
    // 0 1 3  0 3 2
    let a = 6 * i
    let b = 2 * i
    f[a] = b
    f[a + 1] = b + 1
    f[a + 2] = b + 3
    f[a + 3] = b
    f[a + 4] = b + 3
    f[a + 5] = b + 2
    if (i == tesselation - 1) {
      f[a + 2] = 1
      f[a + 4] = 1
      f[a + 5] = 0
    }
    if (caps) {
      v.set([r * c, -h, r * s], 6 * (tesselation + i))
      v.set([r * c, h, r * s], 6 * (tesselation + i) + 3)
      n.set([0, -1, 0], 6 * (tesselation + i))
      n.set([0, 1, 0], 6 * (tesselation + i) + 3)
      a += 6 * tesselation
      b += 2 * tesselation
      f[a] = 2 * tesselation
      f[a + 1] = b
      f[a + 2] = b + 2
      f[a + 3] = 2 * tesselation + 1
      f[a + 4] = b + 3
      f[a + 5] = b + 1
      if (i == tesselation - 1) {
        f[a + 2] = 0
        f[a + 4] = 1
      }
    }
  }

  return { vertices: v, normals: n, indices: f }
}

// export const icosahedronEdges = new Uint32Array([
//   0,1, 0,2, 0,3, 0,4, 0,5,
//   1,2, 2,3, 3,4, 4,5, 5,1,
//   1,6, 2,6, 2,7, 3,7, 3,8, 4,8, 4,9, 5,9, 5,10, 1,10,
//   6,7, 7,8, 8,9, 9,10, 10,6,
//   // 6,11, 7,11, 8,11, 9,11, 10,11,
//   6,11, 7,11, 8,11, 10,11, 8,12, 9,12, //10,12, 11,12,
//   10,13, 11,13, 11,12, 9,13, //12,13
//   9,14, 11,14, 12,14, 13,14
// ]);

export const icosahedronEdges = new Uint32Array([
  0,
  1,
  0,
  2,
  0,
  3,
  0,
  4,
  0,
  5,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  1,
  1,
  6,
  2,
  6,
  2,
  7,
  3,
  7,
  3,
  8,
  4,
  8,
  4,
  9,
  5,
  9,
  5,
  10,
  1,
  10,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  6,
  // 6,11, 7,11, 8,11, 9,11, 10,11,
  6,
  11,
  7,
  11,
  8,
  11,
  8,
  12,
  9,
  12, //10,12, 11,12,
  10,
  13,
  9,
  13, //12,13
  9,
  14,
  12,
  14,
  13,
  14,
  10,
  15,
  11,
  15,
  12,
  15,
  13,
  15,
  14,
  15,
  11,
  10,
  11,
  12,
])

export const tetrahedronHalfEdges = new Uint32Array([
  0, 4, 2, 0, 0, 6, 8, 1, 0, 0, 4, 2, 0, 10, 7, 0, 0, 2, 0, 1, 0, 9, 11, 2, 0, 8, 1, 0, 0, 3, 10, 3,
  0, 1, 6, 3, 0, 11, 5, 1, 0, 7, 3, 2, 0, 5, 9, 3,
])

const r = 0.4
export const tetrahedronVertexPositions = new Float32Array([
  r,
  r,
  r,
  -r,
  -r,
  r,
  -r,
  r,
  -r,
  r,
  -r,
  -r,
])

export const octahedronHalfEdges = new Uint32Array([
  0, 4, 17, 4, 1, 21, 22, 1, 2, 15, 16, 2, 3, 10, 7, 0, 0, 17, 0, 1, 4, 9, 11, 2, 5, 13, 18, 0, 3,
  3, 10, 3, 6, 23, 12, 3, 4, 11, 5, 1, 3, 7, 3, 2, 4, 5, 9, 3, 6, 8, 23, 5, 5, 18, 6, 3, 7, 19, 20,
  4, 2, 16, 2, 0, 2, 2, 15, 4, 0, 0, 4, 2, 5, 6, 13, 5, 7, 20, 14, 0, 7, 14, 19, 5, 1, 22, 1, 4, 1,
  1, 21, 5, 6, 12, 8, 1,
])

const a = 0.75
export const octahedronVertexPositions = new Float32Array([
  0,
  a,
  0,
  0,
  -a,
  0,
  0,
  0,
  a,
  -a,
  0,
  0,
  a,
  0,
  0,
  0,
  0,
  -a,
])

export const torusHalfEdges = () => {
  const h = new Uint32Array(72 * 4 * 4)

  for (let i = 0; i < 4; i++) {
    const v = 12 * i
    const e = 72 * i

    const previous = new Int32Array([
      -14, 24, -10, 11, -6, 13, -2, 17, 1, 18, 9, 12, 3, 14, 5, 23, 15, 30, 10, 26, 19, 28, 21, 16,
      8, 33, 20, 37, 22, 41, 7, 45, 47, 34, 25, 48, 35, 38, 27, 50, 39, 42, 29, 52, 43, 46, 31, 54,
      36, 59, 40, 63, 44, 67, 32, 71, 55, 72, 57, 60, 49, 74, 61, 64, 51, 76, 65, 68, 53, 78, 69,
      56,
    ])
    for (let j = 0; j < 72; j++) {
      let prev = previous[j]
      if (i === 0 && prev < 0) prev += 288
      if (i === 3 && prev > 71) prev -= 288
      h[4 * (e + j) + 1] = e + prev
    }

    const next = new Int32Array([
      -15, 8, -11, 12, -7, 14, -3, 30, 24, 10, 18, 3, 11, 5, 13, 16, 23, 7, 9, 20, 26, 22, 28, 15,
      1, 34, 19, 38, 21, 42, 17, 46, 54, 25, 33, 36, 48, 27, 37, 40, 50, 29, 41, 44, 52, 31, 45, 32,
      35, 60, 39, 64, 43, 68, 47, 56, 71, 58, 72, 49, 59, 62, 74, 51, 63, 66, 76, 53, 67, 70, 78,
      55,
    ])
    for (let j = 0; j < 72; j++) {
      let ne = next[j]
      if (i === 0 && ne < 0) ne += 288
      if (i === 3 && ne > 71) ne -= 288
      h[4 * (e + j) + 2] = e + ne
    }

    const vertex = new Uint32Array([
      0, 1, 1, 2, 2, 3, 3, 0, 5, 1, 4, 1, 4, 2, 4, 3, 7, 3, 5, 4, 6, 4, 7, 4, 0, 5, 5, 6, 6, 7, 7,
      0, 8, 0, 8, 5, 9, 5, 9, 6, 10, 6, 10, 7, 11, 7, 11, 0, 8, 9, 9, 10, 10, 11, 11, 8, 12, 8, 13,
      8, 13, 9, 14, 9, 14, 10, 15, 10, 15, 11, 12, 11,
    ])
    for (let j = 0; j < 72; j++) {
      let vert = vertex[j]
      if (i === 3 && vert > 11) vert -= 48
      h[4 * (e + j) + 3] = v + vert
    }
  }

  return h
}

export const torusVertexPositions = new Float32Array([
  -0.43, -0.9, -0.0, -0.69, -1.23, -0.68, -0.37, -1.93, -0.47, -0.11, -1.6, 0.2, -0.89, -1.56, 0.01,
  -1.21, -0.86, -0.19, -1.4, -1.2, 0.5, -0.63, -1.24, 0.69, -0.82, -0.2, 0.03, -1.5, -0.41, 0.39,
  -1.09, -0.68, 1.02, -0.41, -0.47, 0.66, -0.51, 0.31, 0.56, -1.28, 0.35, 0.36, -1.47, 0.01, 1.06,
  -0.7, -0.02, 1.26, -1.02, 0.67, 1.05, -0.83, 1.01, 0.35, -0.57, 1.33, 1.03, -0.25, 0.63, 1.24,
  -0.15, 0.76, 0.01, -0.19, 1.49, 0.35, 0.21, 1.22, 0.98, 0.26, 0.5, 0.64, 0.63, 0.66, -0.04, 0.31,
  1.36, -0.24, 0.57, 1.68, 0.43, 0.89, 0.98, 0.64, 1.09, 1.31, -0.05, 0.83, 0.99, -0.74, 1.6, 0.95,
  -0.54, 1.41, 0.61, 0.15, 0.61, 0.22, -0.71, 1.29, 0.43, -1.07, 1.7, 0.16, -0.44, 1.02, -0.04,
  -0.08, 0.71, -0.55, -0.6, 0.9, -0.22, -1.3, 1.68, -0.26, -1.11, 1.48, -0.6, -0.41, 1.22, -0.92,
  -1.09, 0.45, -0.88, -1.28, 0.77, -1.58, -1.08, 1.03, -1.26, -0.39, -0.05, -0.74, -0.68, -0.01,
  -1.47, -1.02, 0.39, -1.74, -0.39, 0.3, -1.0, -0.1,
])
