import { Component, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useLoader, type ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { Eraser, MapPin, Paintbrush, RefreshCw, Rotate3D } from 'lucide-react'
import { DoubleSide, InstancedMesh, Mesh, MeshStandardMaterial, Object3D } from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import type { Locale } from '../lib/i18n'

export type HeadPoint = { x: number; y: number; z: number }
export type HeadLayer = {
  id: string
  marks: HeadPoint[]
  mode: 'point' | 'area'
  color: string
  label?: string
}
const HEAD_MODEL_URL = '/models/head-model.obj?v=2'

useLoader.preload(OBJLoader, HEAD_MODEL_URL)

type Props = {
  locale: Locale
  theme?: 'light' | 'dark'
  marks: HeadPoint[]
  mode: 'point' | 'area'
  onModeChange: (mode: 'point' | 'area') => void
  onMarksChange: (marks: HeadPoint[]) => void
  readOnly?: boolean
  layers?: HeadLayer[]
  compact?: boolean
  cameraPosition?: [number, number, number]
}

function layerCenter(marks: HeadPoint[]) {
  if (!marks.length) return null
  return marks.reduce((center, mark) => ({
    x: center.x + mark.x / marks.length,
    y: center.y + mark.y / marks.length,
    z: center.z + mark.z / marks.length,
  }), { x: 0, y: 0, z: 0 })
}

function MarkerLayer({ layer, readOnly }: { layer: HeadLayer; readOnly: boolean }) {
  const mesh = useRef<InstancedMesh>(null)
  const transform = useMemo(() => new Object3D(), [])
  const center = layerCenter(layer.marks)
  const numberedPoint = readOnly && Boolean(layer.label) && layer.mode === 'point'
  const visibleMarks = numberedPoint ? [] : layer.marks

  useLayoutEffect(() => {
    if (!mesh.current) return
    visibleMarks.forEach((mark, index) => {
      transform.position.set(mark.x, mark.y, mark.z)
      transform.updateMatrix()
      mesh.current?.setMatrixAt(index, transform.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  }, [transform, visibleMarks])

  return (
    <group>
      {visibleMarks.length > 0 && <instancedMesh ref={mesh} args={[undefined, undefined, visibleMarks.length]}>
        <sphereGeometry args={[layer.mode === 'area' ? 0.0375 : 0.0525, 16, 16]} />
        <meshStandardMaterial color={layer.color} emissive={layer.color} emissiveIntensity={0.2} />
      </instancedMesh>}
      {readOnly && layer.label && center && (
        <Html position={[center.x, center.y, center.z]} center style={{ pointerEvents: 'none' }}>
          <span className="head-marker-label" style={{ '--marker-color': layer.color } as React.CSSProperties} aria-hidden="true">{layer.label}</span>
        </Html>
      )}
    </group>
  )
}

function InteractiveHead({ marks, mode, onMarksChange, readOnly = false, layers }: Omit<Props, 'locale' | 'onModeChange' | 'theme'>) {
  const drawing = useRef(false)
  const lastPoint = useRef<HeadPoint | null>(null)
  const source = useLoader(OBJLoader, HEAD_MODEL_URL)
  const head = useMemo(() => {
    const clone = source.clone(true)
    clone.traverse((child) => {
      if (child instanceof Mesh) {
        child.material = new MeshStandardMaterial({ color: '#d7b69c', roughness: 0.72, metalness: 0, side: DoubleSide })
      }
    })
    return clone
  }, [source])

  function addPoint(event: ThreeEvent<PointerEvent>) {
    if (readOnly) return
    event.stopPropagation()
    const point = { x: event.point.x, y: event.point.y, z: event.point.z }
    if (mode === 'point') {
      onMarksChange([point])
      return
    }
    const previous = lastPoint.current
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y, point.z - previous.z) > 0.09) {
      onMarksChange([...marks, point].slice(-120))
      lastPoint.current = point
    }
  }

  const handlers = {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => { drawing.current = true; addPoint(event) },
    onPointerMove: (event: ThreeEvent<PointerEvent>) => { if (drawing.current && mode === 'area') addPoint(event) },
    onPointerUp: () => { drawing.current = false; lastPoint.current = null },
    onPointerOut: () => { drawing.current = false; lastPoint.current = null },
  }
  const displayLayers: HeadLayer[] = layers?.length ? layers : [{ id: 'current', marks, mode, color: '#d94d61' }]

  return (
    <>
      <primitive object={head} position={[0, -1.1, -0.08]} scale={0.08} {...(readOnly ? {} : handlers)} dispose={null} />
      {displayLayers.map((layer) => <MarkerLayer key={layer.id} layer={layer} readOnly={readOnly} />)}
    </>
  )
}

class HeadCanvasBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function CanvasFallback({ ar, onRetry }: { ar: boolean; onRetry: () => void }) {
  return (
    <div className="head-canvas-fallback" role="status">
      <p>{ar ? 'تعذّر تشغيل المجسّم على الجهاز.' : 'The 3D head could not start on this device.'}</p>
      <button className="secondary-button" type="button" onClick={onRetry}><RefreshCw size={17} />{ar ? 'جرّب مرة ثانية' : 'Try again'}</button>
    </div>
  )
}

export function HeadMap3D({ locale, theme = 'light', marks, mode, onModeChange, onMarksChange, readOnly = false, layers, compact = false, cameraPosition = [0, 0, 3.4] }: Props) {
  const ar = locale === 'ar'
  const [rotate, setRotate] = useState(true)
  const [canvasKey, setCanvasKey] = useState(0)
  const [contextLost, setContextLost] = useState(false)
  const layeredHistory = readOnly && (layers?.length ?? 0) > 1
  const retryCanvas = () => { setContextLost(false); setCanvasKey((value) => value + 1) }

  return (
    <section className={`head-map-card ${compact ? 'compact' : ''}`} aria-labelledby={compact ? undefined : 'head-map-title'} aria-label={compact ? (ar ? 'معاينة ثلاثية الأبعاد لمكان الألم في هذا الوقت' : '3D preview of the pain location at this time') : undefined}>
      {!compact && <div className="card-heading-row">
        <div>
          <p className="eyebrow">3D</p>
          <h3 id="head-map-title">{ar ? 'وين كان الوجع؟' : 'Where did it hurt?'}</h3>
        </div>
        <button className={`icon-button ${rotate ? 'selected' : ''}`} type="button" onClick={() => setRotate(!rotate)} aria-label={ar ? 'تفعيل تدوير الرأس' : 'Toggle head rotation'}><Rotate3D size={19} /></button>
      </div>}
      {!readOnly && <div className="map-toolbar" role="group" aria-label={ar ? 'طريقة تحديد الألم' : 'Pain marking mode'}>
        <button className={mode === 'point' ? 'selected' : ''} type="button" onClick={() => { onModeChange('point'); setRotate(false) }}><MapPin size={17} />{ar ? 'نقطة' : 'Point'}</button>
        <button className={mode === 'area' ? 'selected' : ''} type="button" onClick={() => { onModeChange('area'); setRotate(false) }}><Paintbrush size={17} />{ar ? 'لوّن مساحة' : 'Paint area'}</button>
        <button type="button" onClick={() => onMarksChange([])}><Eraser size={17} />{ar ? 'مسح' : 'Clear'}</button>
      </div>}
      <div className={`head-canvas ${readOnly ? 'read-only' : ''}`} role="img" aria-label={readOnly ? (layeredHistory ? (ar ? 'مجسّم رأس يعرض تطوّر أماكن الألم المحفوظة' : '3D head showing saved pain-location progression') : (ar ? 'مجسّم رأس يعرض مكان الألم المحفوظ' : '3D head showing the saved pain location')) : (ar ? 'مجسّم رأس ثلاثي الأبعاد لتحديد مكان الألم' : 'Interactive 3D head for marking pain location')}>
        {contextLost ? <CanvasFallback ar={ar} onRetry={retryCanvas} /> : (
          <HeadCanvasBoundary key={canvasKey} fallback={<CanvasFallback ar={ar} onRetry={retryCanvas} />}>
            <Canvas
              camera={{ position: cameraPosition, fov: compact ? 43 : 39 }}
              dpr={1}
              fallback={<CanvasFallback ar={ar} onRetry={retryCanvas} />}
              gl={{ antialias: false, alpha: false, powerPreference: 'low-power', precision: 'mediump' }}
              onCreated={({ gl, camera }) => {
                camera.lookAt(0, 0, 0)
                camera.updateProjectionMatrix()
                gl.domElement.addEventListener('webglcontextlost', (event) => {
                  event.preventDefault()
                  setContextLost(true)
                }, { once: true })
              }}
            >
              <color attach="background" args={[theme === 'dark' ? '#111f1c' : '#edf5f1']} />
              <ambientLight intensity={1.4} />
              <directionalLight position={[3, 4, 5]} intensity={2.2} />
              <directionalLight position={[-3, 1, 2]} intensity={0.8} />
              <InteractiveHead marks={marks} mode={mode} onMarksChange={onMarksChange} readOnly={readOnly} layers={layers} />
              <OrbitControls enabled={!compact && rotate} enablePan={false} minDistance={2.6} maxDistance={4.2} />
            </Canvas>
          </HeadCanvasBoundary>
        )}
      </div>
      {!compact && <p className="map-help">{readOnly ? (ar ? 'اسحب لتدوّر الرأس وتشوف المكان المحفوظ من كل الجهات.' : 'Drag to rotate and inspect the saved location.') : rotate ? (ar ? 'اسحب لتدوّر الرأس. طفّي زر التدوير حتى تحط العلامة.' : 'Drag to rotate. Turn rotation off to place a mark.') : (ar ? 'اكبس أو اسحب على الرأس لتحدد الوجع.' : 'Tap or drag on the head to mark the pain.')}</p>}
    </section>
  )
}
