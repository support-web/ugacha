import { useEffect, useRef, useState } from 'react'
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js'
import { AdvancedBloomFilter } from 'pixi-filters'
import gsap from 'gsap'

// Fortune results
const FORTUNES = [
  { rank: '大吉', color: 0xffd700, message: '最高の運勢！素晴らしい一日になるでしょう' },
  { rank: '中吉', color: 0xff6b9d, message: '良い運勢です。前向きに行動しましょう' },
  { rank: '小吉', color: 0x7dd3fc, message: 'まずまずの運勢。穏やかに過ごせます' },
  { rank: '吉', color: 0x86efac, message: '普通の運勢。地道な努力が実を結びます' },
  { rank: '末吉', color: 0xc4b5fd, message: '控えめな運勢。慎重に行動しましょう' },
  { rank: '凶', color: 0x94a3b8, message: '今日は慎重に。明日はきっと良い日に' },
]

// Particle class for physics-based movement
class Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: number
  gravity: number
  friction: number

  constructor(x: number, y: number, color: number) {
    this.x = x
    this.y = y
    const angle = Math.random() * Math.PI * 2
    const speed = Math.random() * 15 + 5
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed
    this.life = 1
    this.maxLife = Math.random() * 2 + 1
    this.size = Math.random() * 4 + 2
    this.color = color
    this.gravity = 0.15
    this.friction = 0.98
  }

  update(delta: number) {
    this.vy += this.gravity * delta
    this.vx *= this.friction
    this.vy *= this.friction
    this.x += this.vx * delta
    this.y += this.vy * delta
    this.life -= delta / 60 / this.maxLife
    return this.life > 0
  }
}

// Concentration line class
class ConcentrationLine {
  angle: number
  speed: number
  length: number
  width: number
  distance: number
  targetX: number
  targetY: number

  constructor(centerX: number, centerY: number) {
    this.angle = Math.random() * Math.PI * 2
    this.speed = Math.random() * 8 + 4
    this.length = Math.random() * 100 + 50
    this.width = Math.random() * 3 + 1
    this.distance = Math.random() * 200 + 400
    this.targetX = centerX
    this.targetY = centerY
  }

  update(delta: number) {
    this.distance -= this.speed * delta
    return this.distance > 0
  }

  getPosition() {
    return {
      x: this.targetX + Math.cos(this.angle) * this.distance,
      y: this.targetY + Math.sin(this.angle) * this.distance,
      endX: this.targetX + Math.cos(this.angle) * (this.distance + this.length),
      endY: this.targetY + Math.sin(this.angle) * (this.distance + this.length),
    }
  }
}

type GachaPhase = 'idle' | 'charging' | 'releasing' | 'result'

export function FortuneGacha() {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (!containerRef.current || isInitialized) return

    const initApp = async () => {
      const app = new Application()

      await app.init({
        background: 0x0a0a1a,
        resizeTo: window,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })

      containerRef.current!.appendChild(app.canvas)
      appRef.current = app

      // State
      let phase: GachaPhase = 'idle'
      let particles: Particle[] = []
      let concentrationLines: ConcentrationLine[] = []
      let energyParticles: Particle[] = []
      let idleTime = 0
      let chargeProgress = 0

      // Get center position
      const getCenterX = () => app.screen.width / 2
      const getCenterY = () => app.screen.height / 2

      // Main container
      const mainContainer = new Container()
      app.stage.addChild(mainContainer)

      // Background layer
      const bgLayer = new Container()
      mainContainer.addChild(bgLayer)

      // Effect layer
      const effectLayer = new Container()
      mainContainer.addChild(effectLayer)

      // Gacha machine layer
      const gachaLayer = new Container()
      mainContainer.addChild(gachaLayer)

      // UI layer
      const uiLayer = new Container()
      mainContainer.addChild(uiLayer)

      // Bloom filter
      const bloomFilter = new AdvancedBloomFilter({
        threshold: 0.3,
        bloomScale: 1.2,
        brightness: 1.2,
        blur: 8,
        quality: 8,
      })
      effectLayer.filters = [bloomFilter]

      // Background graphics
      const bgGraphics = new Graphics()
      bgLayer.addChild(bgGraphics)

      // Draw starfield background
      const drawBackground = () => {
        bgGraphics.clear()
        bgGraphics.rect(0, 0, app.screen.width, app.screen.height)
        bgGraphics.fill(0x0a0a1a)

        // Stars
        for (let i = 0; i < 100; i++) {
          const x = Math.random() * app.screen.width
          const y = Math.random() * app.screen.height
          const size = Math.random() * 2
          const alpha = Math.random() * 0.5 + 0.2
          bgGraphics.circle(x, y, size)
          bgGraphics.fill({ color: 0xffffff, alpha })
        }
      }
      drawBackground()

      // Gacha machine graphics
      const gachaGraphics = new Graphics()
      gachaLayer.addChild(gachaGraphics)

      // Glow effect for gacha
      const glowGraphics = new Graphics()
      effectLayer.addChild(glowGraphics)

      // Effect graphics
      const effectGraphics = new Graphics()
      effectLayer.addChild(effectGraphics)

      // Darkening overlay
      const overlay = new Graphics()
      overlay.rect(0, 0, app.screen.width, app.screen.height)
      overlay.fill({ color: 0x000000, alpha: 0 })
      uiLayer.addChild(overlay)

      // Result card container
      const cardContainer = new Container()
      cardContainer.visible = false
      uiLayer.addChild(cardContainer)

      // Card graphics
      const cardBg = new Graphics()
      cardContainer.addChild(cardBg)

      // Card text
      const rankStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 72,
        fontWeight: 'bold',
        fill: 0xffffff,
        dropShadow: {
          color: 0x000000,
          blur: 10,
          distance: 0,
        },
      })
      const rankText = new Text({ text: '', style: rankStyle })
      rankText.anchor.set(0.5)
      cardContainer.addChild(rankText)

      const messageStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 20,
        fill: 0xffffff,
        wordWrap: true,
        wordWrapWidth: 280,
        align: 'center',
      })
      const messageText = new Text({ text: '', style: messageStyle })
      messageText.anchor.set(0.5, 0)
      cardContainer.addChild(messageText)

      // Instruction text
      const instructionStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 24,
        fill: 0xffffff,
        dropShadow: {
          color: 0x000000,
          blur: 4,
          distance: 2,
        },
      })
      const instructionText = new Text({
        text: 'TAP TO DRAW YOUR FORTUNE',
        style: instructionStyle
      })
      instructionText.anchor.set(0.5)
      uiLayer.addChild(instructionText)

      // Draw gacha machine
      const drawGachaMachine = (glowIntensity: number) => {
        const cx = getCenterX()
        const cy = getCenterY()

        gachaGraphics.clear()
        glowGraphics.clear()

        // Outer glow
        const glowSize = 180 + glowIntensity * 20
        for (let i = 5; i > 0; i--) {
          const alpha = (0.1 + glowIntensity * 0.15) * (i / 5)
          glowGraphics.circle(cx, cy, glowSize + i * 15)
          glowGraphics.fill({ color: 0x6366f1, alpha })
        }

        // Main sphere
        gachaGraphics.circle(cx, cy, 120)
        const gradient1 = 0x1e1b4b
        gachaGraphics.fill(gradient1)

        // Inner glow ring
        gachaGraphics.circle(cx, cy, 100)
        gachaGraphics.stroke({ color: 0x818cf8, width: 3, alpha: 0.5 + glowIntensity * 0.5 })

        // Crystal in center
        gachaGraphics.circle(cx, cy, 60)
        gachaGraphics.fill({ color: 0x4f46e5, alpha: 0.8 })

        // Highlight
        gachaGraphics.circle(cx - 20, cy - 25, 25)
        gachaGraphics.fill({ color: 0xffffff, alpha: 0.2 + glowIntensity * 0.2 })

        // Energy rings
        const ringCount = 3
        for (let i = 0; i < ringCount; i++) {
          const radius = 80 + i * 25
          const alpha = 0.3 + glowIntensity * 0.4
          gachaGraphics.circle(cx, cy, radius)
          gachaGraphics.stroke({ color: 0xa5b4fc, width: 2, alpha: alpha * (1 - i * 0.2) })
        }
      }

      // Draw particles
      const drawParticles = () => {
        effectGraphics.clear()

        // Draw concentration lines
        for (const line of concentrationLines) {
          const pos = line.getPosition()
          effectGraphics.moveTo(pos.x, pos.y)
          effectGraphics.lineTo(pos.endX, pos.endY)
          effectGraphics.stroke({ color: 0xffffff, width: line.width, alpha: 0.6 })
        }

        // Draw energy particles (during charging)
        for (const p of energyParticles) {
          effectGraphics.circle(p.x, p.y, p.size * p.life)
          effectGraphics.fill({ color: p.color, alpha: p.life * 0.8 })
        }

        // Draw explosion particles
        for (const p of particles) {
          effectGraphics.circle(p.x, p.y, p.size * Math.min(1, p.life * 2))
          effectGraphics.fill({ color: p.color, alpha: p.life * 0.9 })
        }
      }

      // Draw result card
      const drawCard = (fortune: typeof FORTUNES[0], progress: number) => {
        const cx = getCenterX()
        const cy = getCenterY()

        cardBg.clear()

        // Card shadow
        cardBg.roundRect(-160, -220, 320, 440, 20)
        cardBg.fill({ color: 0x000000, alpha: 0.3 })

        // Card background
        cardBg.roundRect(-155, -225, 310, 430, 20)
        cardBg.fill(0x1e1b4b)

        // Card border with fortune color
        cardBg.roundRect(-155, -225, 310, 430, 20)
        cardBg.stroke({ color: fortune.color, width: 4 })

        // Inner decoration
        cardBg.roundRect(-135, -205, 270, 390, 10)
        cardBg.stroke({ color: fortune.color, width: 1, alpha: 0.5 })

        // Halo effect behind card
        for (let i = 8; i > 0; i--) {
          const haloAlpha = 0.15 * (i / 8) * progress
          cardBg.circle(0, 0, 200 + i * 30)
          cardBg.fill({ color: fortune.color, alpha: haloAlpha })
        }

        cardContainer.position.set(cx, cy)
        rankText.text = fortune.rank
        rankText.style.fill = fortune.color
        rankText.position.set(0, -80)

        messageText.text = fortune.message
        messageText.position.set(0, 20)
      }

      // Update overlay size
      const updateOverlay = (alpha: number) => {
        overlay.clear()
        overlay.rect(0, 0, app.screen.width, app.screen.height)
        overlay.fill({ color: 0x000000, alpha })
      }

      // Add energy particle moving toward center
      const addEnergyParticle = () => {
        const cx = getCenterX()
        const cy = getCenterY()
        const angle = Math.random() * Math.PI * 2
        const distance = 300 + Math.random() * 200
        const x = cx + Math.cos(angle) * distance
        const y = cy + Math.sin(angle) * distance

        const particle = new Particle(x, y, 0xa5b4fc)
        // Override velocity to move toward center
        const speed = Math.random() * 5 + 3
        particle.vx = (cx - x) / distance * speed * 3
        particle.vy = (cy - y) / distance * speed * 3
        particle.gravity = 0
        particle.friction = 1
        particle.maxLife = distance / (speed * 60)
        energyParticles.push(particle)
      }

      // Add concentration line
      const addConcentrationLine = () => {
        concentrationLines.push(new ConcentrationLine(getCenterX(), getCenterY()))
      }

      // Handle tap/click
      let selectedFortune: typeof FORTUNES[0] | null = null

      const handleTap = () => {
        if (phase === 'idle') {
          phase = 'charging'
          chargeProgress = 0
          selectedFortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)]
          instructionText.visible = false

          // Darken screen
          gsap.to({ value: 0 }, {
            value: 0.7,
            duration: 0.5,
            onUpdate: function() {
              updateOverlay(this.targets()[0].value)
            }
          })

          // Intensify bloom during charge
          gsap.to(bloomFilter, {
            bloomScale: 2,
            brightness: 1.5,
            duration: 1.5,
          })

        } else if (phase === 'result') {
          // Reset to idle
          phase = 'idle'
          cardContainer.visible = false
          particles = []
          instructionText.visible = true

          gsap.to({ value: 0.7 }, {
            value: 0,
            duration: 0.5,
            onUpdate: function() {
              updateOverlay(this.targets()[0].value)
            }
          })

          gsap.to(bloomFilter, {
            bloomScale: 1.2,
            brightness: 1.2,
            duration: 0.5,
          })
        }
      }

      app.canvas.addEventListener('pointerdown', handleTap)

      // Main game loop
      app.ticker.add((ticker) => {
        const delta = ticker.deltaTime

        if (phase === 'idle') {
          // Breathing animation
          idleTime += delta * 0.02
          const breathe = Math.sin(idleTime) * 0.5 + 0.5
          drawGachaMachine(breathe * 0.5)

          // Animate instruction text
          instructionText.alpha = 0.5 + Math.sin(idleTime * 2) * 0.3
          instructionText.position.set(getCenterX(), getCenterY() + 200)

        } else if (phase === 'charging') {
          chargeProgress += delta / 90 // ~1.5 seconds charge time

          // Add energy effects
          if (Math.random() < 0.3) addEnergyParticle()
          if (Math.random() < 0.2) addConcentrationLine()

          // Update energy particles
          energyParticles = energyParticles.filter(p => {
            const alive = p.update(delta)
            // Check if reached center
            const cx = getCenterX()
            const cy = getCenterY()
            const dist = Math.hypot(p.x - cx, p.y - cy)
            if (dist < 50) return false
            return alive
          })

          // Update concentration lines
          concentrationLines = concentrationLines.filter(l => l.update(delta))

          // Intense glow
          drawGachaMachine(0.5 + chargeProgress * 0.5)

          // Scale up gacha machine slightly
          gachaLayer.scale.set(1 + chargeProgress * 0.1)
          gachaLayer.position.set(
            getCenterX() * (1 - gachaLayer.scale.x) + getCenterX() * (gachaLayer.scale.x - 1),
            getCenterY() * (1 - gachaLayer.scale.y) + getCenterY() * (gachaLayer.scale.y - 1)
          )

          if (chargeProgress >= 1) {
            phase = 'releasing'
            chargeProgress = 0

            // Flash effect
            gsap.to({ value: 1 }, {
              value: 0,
              duration: 0.3,
              onUpdate: function() {
                const v = this.targets()[0].value
                bgGraphics.clear()
                bgGraphics.rect(0, 0, app.screen.width, app.screen.height)
                bgGraphics.fill({ color: 0xffffff, alpha: v })
              },
              onComplete: () => {
                drawBackground()
              }
            })

            // Explosion
            const cx = getCenterX()
            const cy = getCenterY()
            const colors = [0xffd700, 0xff6b9d, 0x7dd3fc, 0xa5b4fc, 0xffffff]
            for (let i = 0; i < 150; i++) {
              const color = colors[Math.floor(Math.random() * colors.length)]
              particles.push(new Particle(cx, cy, color))
            }

            // Max bloom
            gsap.to(bloomFilter, {
              bloomScale: 3,
              brightness: 2,
              duration: 0.2,
              yoyo: true,
              repeat: 1,
            })

            // Clear concentration effects
            concentrationLines = []
            energyParticles = []
          }

        } else if (phase === 'releasing') {
          chargeProgress += delta / 60 // ~1 second release

          // Update particles with physics
          particles = particles.filter(p => p.update(delta))

          // Fade gacha machine
          gachaGraphics.alpha = 1 - chargeProgress
          glowGraphics.alpha = 1 - chargeProgress

          if (chargeProgress >= 1 && selectedFortune) {
            phase = 'result'
            gachaLayer.scale.set(1)

            // Show card with animation
            cardContainer.visible = true
            cardContainer.scale.set(0)
            cardContainer.rotation = Math.PI

            drawCard(selectedFortune, 1)

            gsap.to(cardContainer.scale, {
              x: 1,
              y: 1,
              duration: 0.8,
              ease: 'back.out(1.5)',
            })

            gsap.to(cardContainer, {
              rotation: 0,
              duration: 0.8,
              ease: 'power2.out',
            })

            // Restore bloom
            gsap.to(bloomFilter, {
              bloomScale: 1.5,
              brightness: 1.3,
              duration: 0.5,
            })
          }

        } else if (phase === 'result') {
          // Ambient particles around card
          if (Math.random() < 0.1 && selectedFortune) {
            const cx = getCenterX()
            const cy = getCenterY()
            const angle = Math.random() * Math.PI * 2
            const dist = 150 + Math.random() * 50
            const p = new Particle(
              cx + Math.cos(angle) * dist,
              cy + Math.sin(angle) * dist,
              selectedFortune.color
            )
            p.vx = (Math.random() - 0.5) * 2
            p.vy = -Math.random() * 2 - 1
            p.gravity = -0.02 // Float upward
            particles.push(p)
          }

          // Update floating particles
          particles = particles.filter(p => p.update(delta))

          // Subtle card animation
          cardContainer.rotation = Math.sin(idleTime * 0.5) * 0.02
          idleTime += delta * 0.02
        }

        // Draw all particles
        drawParticles()
      })

      // Handle resize
      const handleResize = () => {
        drawBackground()
        instructionText.position.set(getCenterX(), getCenterY() + 200)
        if (phase === 'result' && selectedFortune) {
          drawCard(selectedFortune, 1)
        }
      }
      window.addEventListener('resize', handleResize)

      setIsInitialized(true)

      return () => {
        window.removeEventListener('resize', handleResize)
        app.canvas.removeEventListener('pointerdown', handleTap)
        app.destroy(true, { children: true })
      }
    }

    initApp()
  }, [isInitialized])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        touchAction: 'none',
      }}
    />
  )
}
