"use client"
import React, { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, Html } from '@react-three/drei'
import * as THREE from 'three'

interface Machine3DProps {
  temperature?: number
  vibration?: number
  rpm?: number
  is_anomaly?: boolean
  power_kw?: number
}

function MachineModel({ temperature = 40, vibration = 0, rpm = 0, is_anomaly = false, power_kw = 0 }: Machine3DProps) {
  const groupRef = useRef<THREE.Group>(null)
  const spindleRef = useRef<THREE.Group>(null)
  const baseGearRef = useRef<THREE.Mesh>(null)
  const coreMaterialRef = useRef<THREE.MeshStandardMaterial>(null)

  // Determine target color based on temperature
  const targetColor = useMemo(() => {
    if (is_anomaly) return new THREE.Color("#ef4444") // Critical Red
    if (temperature > 75) return new THREE.Color("#f87171") // Warning Red
    if (temperature > 60) return new THREE.Color("#fbbf24") // Warning Yellow
    return new THREE.Color("#3b82f6") // Normal Blue
  }, [temperature, is_anomaly])

  useFrame((state, delta) => {
    // Smoothly transition core color
    if (coreMaterialRef.current) {
      coreMaterialRef.current.color.lerp(targetColor, 0.05)
      // Pulsing emissive effect if anomaly
      if (is_anomaly) {
        coreMaterialRef.current.emissiveIntensity = 2 + Math.sin(state.clock.elapsedTime * 10) * 1.5
      } else {
        coreMaterialRef.current.emissiveIntensity = 1 + (temperature / 100)
      }
    }

    // Spin the spindle and base gear based on RPM
    const rotationSpeed = (rpm / 60) * Math.PI * 2 * delta * 0.1
    if (spindleRef.current) spindleRef.current.rotation.y += rotationSpeed
    if (baseGearRef.current) baseGearRef.current.rotation.y -= rotationSpeed * 0.5 // Gear spins opposite

    // Shake the whole machine based on vibration
    if (groupRef.current) {
      if (vibration > 4.5) {
        const shakeIntensity = (vibration - 4.5) * 0.03
        groupRef.current.position.x = (Math.random() - 0.5) * shakeIntensity
        groupRef.current.position.z = (Math.random() - 0.5) * shakeIntensity
      } else {
        groupRef.current.position.lerp(new THREE.Vector3(0, 0, 0), 0.1)
      }
    }
  })

  return (
    <group ref={groupRef} position={[0, -0.5, 0]}>
      {/* Heavy Base Assembly */}
      <mesh position={[0, -1, 0]}>
        <boxGeometry args={[4.5, 0.4, 4.5]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Rotating Base Gear */}
      <mesh ref={baseGearRef} position={[0, -0.7, 0]}>
        <cylinderGeometry args={[1.8, 1.8, 0.2, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.4} />
      </mesh>

      {/* Main Support Struts */}
      <mesh position={[-1.2, 0.8, -1.2]}>
        <boxGeometry args={[0.5, 3, 0.5]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[1.2, 0.8, -1.2]}>
        <boxGeometry args={[0.5, 3, 0.5]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[-1.2, 0.8, 1.2]}>
        <boxGeometry args={[0.5, 3, 0.5]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[1.2, 0.8, 1.2]}>
        <boxGeometry args={[0.5, 3, 0.5]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Glowing Energy/Heat Core */}
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 1.8, 32]} />
        <meshStandardMaterial 
          ref={coreMaterialRef} 
          color="#3b82f6" 
          emissive="#3b82f6" 
          toneMapped={false} 
        />
      </mesh>

      {/* Core Rings (Heat Sinks) */}
      {[0.2, 0.8, 1.4].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.9, 0.1, 16, 32]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}

      {/* Top Housing */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 0.5, 32]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.2} />
      </mesh>

      {/* Spindle & Tool */}
      <group ref={spindleRef} position={[0, 2.5, 0]}>
        <mesh position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 1.5, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 1.8, 0]}>
          <cylinderGeometry args={[0.1, 0.4, 0.5, 16]} />
          <meshStandardMaterial color="#f8fafc" metalness={1} roughness={0} />
        </mesh>
      </group>

      {/* AR Data Overlays (HUD) */}
      <Html position={[1.5, 1, 0]} center distanceFactor={12}>
        <div className="bg-slate-900/80 backdrop-blur border border-slate-700 p-2 rounded-lg text-white pointer-events-none select-none flex flex-col gap-1 w-32 shadow-xl">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Core Temp</p>
          <p className="text-xl font-black" style={{ color: temperature > 75 ? '#ef4444' : '#3b82f6' }}>
            {temperature.toFixed(1)}°C
          </p>
        </div>
      </Html>

      <Html position={[-1.5, 3.5, 0]} center distanceFactor={12}>
        <div className="bg-slate-900/80 backdrop-blur border border-slate-700 p-2 rounded-lg text-white pointer-events-none select-none flex flex-col gap-1 w-32 shadow-xl">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Spindle Speed</p>
          <p className="text-xl font-black text-emerald-400">
            {rpm.toFixed(0)} <span className="text-xs font-normal text-slate-400">RPM</span>
          </p>
        </div>
      </Html>

      <Html position={[1.5, 3.5, 0]} center distanceFactor={12}>
        <div className="bg-slate-900/80 backdrop-blur border border-slate-700 p-2 rounded-lg text-white pointer-events-none select-none flex flex-col gap-1 w-32 shadow-xl">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Power Draw</p>
          <p className="text-xl font-black text-amber-400">
            {power_kw.toFixed(1)} <span className="text-xs font-normal text-slate-400">kW</span>
          </p>
        </div>
      </Html>
    </group>
  )
}

function CameraController({ is_anomaly }: { is_anomaly: boolean }) {
  useFrame((state) => {
    // If anomaly, smoothly zoom in and angle down towards the core
    if (is_anomaly) {
      state.camera.position.lerp(new THREE.Vector3(4, 3, 4), 0.05)
    } else {
      // Normal roaming view
      state.camera.position.lerp(new THREE.Vector3(7, 5, 7), 0.02)
    }
    state.camera.lookAt(0, 1, 0)
  })
  return null
}

export default function Machine3D({ temperature, vibration, rpm, is_anomaly, power_kw }: Machine3DProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="w-full h-[400px] bg-[#131e33] rounded-xl flex items-center justify-center text-slate-500">Loading 3D...</div>

  return (
    <div className="w-full h-[400px] bg-[#0b1120] rounded-xl overflow-hidden border border-[#1C7293]/30 relative shadow-2xl">
      <Canvas dpr={[0.5, 1]} camera={{ position: [7, 5, 7], fov: 45 }} performance={{ min: 0.1 }}>
        <color attach="background" args={['#0b1120']} />
        
        {/* Cinematic Lighting */}
        <ambientLight intensity={0.2} />
        <spotLight position={[5, 10, 5]} intensity={2} angle={0.5} penumbra={1} color="#e2e8f0" />
        <spotLight position={[-5, 5, -5]} intensity={1} color="#3b82f6" />
        <Environment preset="city" />
        
        <MachineModel temperature={temperature} vibration={vibration} rpm={rpm} is_anomaly={is_anomaly} power_kw={power_kw} />
        
        {/* Removed ContactShadows for integrated graphics performance */}
        
        {/* Dynamic Camera */}
        <CameraController is_anomaly={!!is_anomaly} />
        
        {/* Orbit Controls (disabled pan/zoom to let CameraController work smoothly) */}
        <OrbitControls enablePan={false} enableZoom={false} autoRotate={!is_anomaly} autoRotateSpeed={0.8} maxPolarAngle={Math.PI / 2 - 0.1} />
      </Canvas>
      
      {/* Overlay info */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <p className="text-sm font-bold text-teal-400 drop-shadow-md">Advanced Digital Twin (AR Mode)</p>
        <p className="text-xs text-slate-300 drop-shadow-md flex items-center gap-2 mt-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Live Telemetry Sync Active
        </p>
      </div>
    </div>
  )
}
