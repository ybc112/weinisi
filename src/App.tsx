import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ethers } from 'ethers'
import {
  ArrowDownToLine,
  ChartNoAxesCombined,
  Check,
  Clock3,
  Coins,
  Copy,
  Gift,
  Hammer,
  Link2,
  LockKeyhole,
  Pickaxe,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

type WalletState = {
  address: string
  network: string
  demo: boolean
}

type MetricProps = {
  icon: ReactNode
  label: string
  value: string
  detail: string
}

type PanelTitleProps = {
  icon: ReactNode
  kicker: string
  title: string
}

const DAY_MS = 86_400_000
const TOKENOMICS = {
  symbol: 'WNS',
  totalSupply: 21_000_000,
  liquidityThreshold: 1_000_000,
  starterMinerValue: 100,
  dailyRate: 0.005,
  monthlyRate: 0.15,
  withdrawMachineGate: 2,
  defaultWithdrawFee: 50,
  headMineDelayDays: 3,
  referralRates: [10, 5, 3, 2, 1, 1, 1, 1, 1],
}

const STORAGE_KEYS = {
  wallet: 'wns.wallet',
  referrer: 'wns.referrer',
  machineCount: 'wns.machineCount',
  availableReward: 'wns.availableReward',
  globalMined: 'wns.globalMined',
  directCount: 'wns.directCount',
  feeRate: 'wns.feeRate',
  launchAt: 'wns.launchAt',
  lastTick: 'wns.lastTick',
}

const demoWallet: WalletState = {
  address: '0x2100000000000000000000000000000000000000',
  network: 'Demo Chain',
  demo: true,
}

function readNumber(key: string, fallback: number) {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

function readWallet() {
  const raw = localStorage.getItem(STORAGE_KEYS.wallet)
  if (!raw) return { address: '', network: '未连接', demo: false }

  try {
    const parsed = JSON.parse(raw) as WalletState
    return parsed.address ? parsed : { address: '', network: '未连接', demo: false }
  } catch {
    return { address: '', network: '未连接', demo: false }
  }
}

function getLaunchAt() {
  const saved = readNumber(STORAGE_KEYS.launchAt, 0)
  if (saved > 0) return saved

  const nextLaunchAt = Date.now() + TOKENOMICS.headMineDelayDays * DAY_MS
  localStorage.setItem(STORAGE_KEYS.launchAt, String(nextLaunchAt))
  return nextLaunchAt
}

function formatToken(value: number, digits = 2) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Math.max(value, 0))
}

function formatWhole(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 0,
  }).format(Math.max(value, 0))
}

function shortAddress(address: string) {
  if (!address) return '连接钱包'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function getCountdown(launchAt: number, now: number) {
  const total = Math.max(launchAt - now, 0)
  const days = Math.floor(total / DAY_MS)
  const hours = Math.floor((total % DAY_MS) / 3_600_000)
  const minutes = Math.floor((total % 3_600_000) / 60_000)
  const seconds = Math.floor((total % 60_000) / 1_000)
  return { total, days, hours, minutes, seconds }
}

function Metric({ icon, label, value, detail }: MetricProps) {
  return (
    <article className="metric">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  )
}

function PanelTitle({ icon, kicker, title }: PanelTitleProps) {
  return (
    <div className="panel-title">
      <div className="panel-icon">{icon}</div>
      <div>
        <span>{kicker}</span>
        <h2>{title}</h2>
      </div>
    </div>
  )
}

export default function App() {
  const [wallet, setWallet] = useState<WalletState>(readWallet)
  const [now, setNow] = useState(Date.now)
  const [launchAt, setLaunchAt] = useState(getLaunchAt)
  const [referrerInput, setReferrerInput] = useState('')
  const [boundReferrer, setBoundReferrer] = useState(() => localStorage.getItem(STORAGE_KEYS.referrer) ?? '')
  const [machineCount, setMachineCount] = useState(() => readNumber(STORAGE_KEYS.machineCount, 0))
  const [availableReward, setAvailableReward] = useState(() => readNumber(STORAGE_KEYS.availableReward, 0))
  const [globalMined, setGlobalMined] = useState(() => readNumber(STORAGE_KEYS.globalMined, 0))
  const [directCount, setDirectCount] = useState(() => readNumber(STORAGE_KEYS.directCount, 0))
  const [feeRate, setFeeRate] = useState(() => readNumber(STORAGE_KEYS.feeRate, TOKENOMICS.defaultWithdrawFee))
  const [lastTick, setLastTick] = useState(() => readNumber(STORAGE_KEYS.lastTick, Date.now()))
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [latestTx, setLatestTx] = useState('等待连接钱包并绑定推荐人')

  const countdown = useMemo(() => getCountdown(launchAt, now), [launchAt, now])
  const miningStarted = countdown.total === 0
  const personalPower = machineCount * TOKENOMICS.starterMinerValue
  const dailyOutput = personalPower * TOKENOMICS.dailyRate
  const monthlyOutput = personalPower * TOKENOMICS.monthlyRate
  const remainingSupply = Math.max(TOKENOMICS.totalSupply - globalMined, 0)
  const liquidityProgress = Math.min((globalMined / TOKENOMICS.liquidityThreshold) * 100, 100)
  const unlockedGenerationCount = Math.min(directCount, TOKENOMICS.referralRates.length)
  const referralBonusRate = TOKENOMICS.referralRates
    .slice(0, unlockedGenerationCount)
    .reduce((total, rate) => total + rate, 0)
  const teamDailyReward = dailyOutput * (referralBonusRate / 100)
  const withdrawValue = Number(withdrawAmount)
  const validWithdrawValue = Number.isFinite(withdrawValue) ? Math.max(withdrawValue, 0) : 0
  const withdrawFee = validWithdrawValue * (feeRate / 100)
  const withdrawNet = Math.max(validWithdrawValue - withdrawFee, 0)
  const referralLink = wallet.address
    ? `${window.location.origin}${window.location.pathname}?ref=${wallet.address}`
    : '连接钱包后生成'

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) setReferrerInput(ref)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!miningStarted || machineCount === 0) {
      setLastTick(now)
      return
    }

    const elapsed = Math.max(now - lastTick, 0)
    if (elapsed === 0) return

    const minedDelta = (dailyOutput * elapsed) / DAY_MS
    const cappedDelta = Math.min(minedDelta, remainingSupply)
    if (cappedDelta <= 0) return

    setAvailableReward((value) => value + cappedDelta)
    setGlobalMined((value) => Math.min(value + cappedDelta, TOKENOMICS.totalSupply))
    setLastTick(now)
  }, [dailyOutput, lastTick, machineCount, miningStarted, now, remainingSupply])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.wallet, JSON.stringify(wallet))
  }, [wallet])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.launchAt, String(launchAt))
  }, [launchAt])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.referrer, boundReferrer)
  }, [boundReferrer])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.machineCount, String(machineCount))
  }, [machineCount])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.availableReward, String(availableReward))
  }, [availableReward])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.globalMined, String(globalMined))
  }, [globalMined])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.directCount, String(directCount))
  }, [directCount])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.feeRate, String(feeRate))
  }, [feeRate])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.lastTick, String(lastTick))
  }, [lastTick])

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        setWallet(demoWallet)
        setLatestTx('未检测到浏览器钱包，已进入演示钱包')
        return
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const accounts = (await provider.send('eth_requestAccounts', [])) as string[]
      const network = await provider.getNetwork()
      setWallet({
        address: accounts[0] ?? '',
        network: network.name === 'unknown' ? `Chain ${network.chainId.toString()}` : network.name,
        demo: false,
      })
      setLatestTx('钱包已连接')
    } catch (error) {
      setLatestTx(error instanceof Error ? error.message : '钱包连接失败')
    }
  }

  function bindReferrer() {
    const normalized = referrerInput.trim()
    const validReferrer = normalized.startsWith('0x') ? ethers.isAddress(normalized) : normalized.length >= 6

    if (!validReferrer) {
      setLatestTx('推荐人地址或邀请码格式不正确')
      return
    }

    if (!wallet.address) {
      setWallet(demoWallet)
    }

    setBoundReferrer(normalized)
    setMachineCount((value) => Math.max(value, 1))
    setLatestTx('推荐人已绑定，100 WNS 矿机已发放')
  }

  function buyMiner() {
    if (!boundReferrer) {
      setLatestTx('请先绑定推荐人')
      return
    }

    setMachineCount((value) => value + 1)
    setLatestTx(`矿机已增加，当前 ${machineCount + 1} 台`)
  }

  function withdraw() {
    if (machineCount < TOKENOMICS.withdrawMachineGate) {
      setLatestTx('提币需要至少两台矿机')
      return
    }

    if (validWithdrawValue <= 0 || validWithdrawValue > availableReward) {
      setLatestTx('提币数量超出可提余额')
      return
    }

    setAvailableReward((value) => Math.max(value - validWithdrawValue, 0))
    setWithdrawAmount('')
    setLatestTx(
      `提币申请已创建，手续费 ${formatToken(withdrawFee)} WNS，预计到账 ${formatToken(withdrawNet)} WNS`,
    )
  }

  function copyReferralLink() {
    if (!wallet.address) {
      setLatestTx('请先连接钱包')
      return
    }

    void navigator.clipboard.writeText(referralLink)
    setLatestTx('推广链接已复制')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-medal">V</div>
          <div>
            <span>WNS Venice</span>
            <strong>威尼斯共识矿池</strong>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="network-pill">{wallet.demo ? '演示模式' : wallet.network}</span>
          <button className="gold-button" type="button" onClick={connectWallet}>
            <Wallet size={18} />
            {shortAddress(wallet.address)}
          </button>
        </div>
      </header>

      <main>
        <section className="hero-panel">
          <div className="hero-copy">
            <span className="eyebrow">VENICE · WNS</span>
            <h1>开启全球共识新时代</h1>
            <p>
              总量 {formatWhole(TOKENOMICS.totalSupply)} 枚，挖出{' '}
              {formatWhole(TOKENOMICS.liquidityThreshold)} 枚后启动流动性矿池。
            </p>
            <div className="hero-badges">
              <span>
                <Pickaxe size={16} />
                每日 0.5%
              </span>
              <span>
                <Gift size={16} />
                赠送 100 WNS 矿机
              </span>
              <span>
                <Users size={16} />
                九代收益
              </span>
            </div>
            <div className="launch-strip">
              <Clock3 size={20} />
              <div>
                <span>{miningStarted ? '头矿已开启' : '头矿倒计时'}</span>
                <strong>
                  {miningStarted
                    ? '正式挖矿中'
                    : `${countdown.days}天 ${countdown.hours}时 ${countdown.minutes}分 ${countdown.seconds}秒`}
                </strong>
              </div>
            </div>
          </div>

          <div className="coin-stage" aria-label="WNS Venice token">
            <div className="coin-ring">
              <div className="coin-face">
                <span>WNS</span>
                <small>VENICE</small>
              </div>
            </div>
            <div className="coin-base" />
          </div>
        </section>

        <section className="metrics-grid" aria-label="WNS statistics">
          <Metric
            icon={<Coins size={24} />}
            label="总发行"
            value={`${formatWhole(TOKENOMICS.totalSupply)} WNS`}
            detail="固定总量"
          />
          <Metric
            icon={<ChartNoAxesCombined size={24} />}
            label="今日产出"
            value={`${formatToken(dailyOutput, 4)} WNS`}
            detail={`月收益 ${formatToken(monthlyOutput)} WNS`}
          />
          <Metric
            icon={<Sparkles size={24} />}
            label="已挖数量"
            value={`${formatToken(globalMined)} WNS`}
            detail={`剩余 ${formatToken(remainingSupply)} WNS`}
          />
          <Metric
            icon={<ShieldCheck size={24} />}
            label="流动性矿池"
            value={`${formatToken(liquidityProgress)}%`}
            detail={globalMined >= TOKENOMICS.liquidityThreshold ? '已达启动线' : '等待 100 万枚'}
          />
        </section>

        <section className="workspace-grid">
          <article className="panel">
            <PanelTitle icon={<Link2 size={22} />} kicker="STEP 01" title="绑定推荐人" />
            <div className="input-row">
              <input
                value={referrerInput}
                onChange={(event) => setReferrerInput(event.target.value)}
                placeholder="推荐人地址或邀请码"
                disabled={Boolean(boundReferrer)}
              />
              <button type="button" onClick={bindReferrer} disabled={Boolean(boundReferrer)}>
                <Check size={18} />
                {boundReferrer ? '已绑定' : '绑定'}
              </button>
            </div>
            <dl className="data-list">
              <div>
                <dt>当前推荐人</dt>
                <dd>{boundReferrer ? shortAddress(boundReferrer) : '未绑定'}</dd>
              </div>
              <div>
                <dt>赠送矿机</dt>
                <dd>{boundReferrer ? '已发放' : '待绑定'}</dd>
              </div>
              <div>
                <dt>推广链接</dt>
                <dd>
                  <button className="text-button" type="button" onClick={copyReferralLink}>
                    <Copy size={16} />
                    复制
                  </button>
                </dd>
              </div>
            </dl>
          </article>

          <article className="panel">
            <PanelTitle icon={<Hammer size={22} />} kicker="MINER" title="矿机收益" />
            <div className="miner-readout">
              <span>{machineCount}</span>
              <div>
                <strong>矿机数量</strong>
                <small>每台价值 100 WNS</small>
              </div>
            </div>
            <div className="progress-track">
              <span style={{ width: `${Math.min((machineCount / 2) * 100, 100)}%` }} />
            </div>
            <dl className="data-list compact">
              <div>
                <dt>算力本金</dt>
                <dd>{formatToken(personalPower)} WNS</dd>
              </div>
              <div>
                <dt>每日收益</dt>
                <dd>{formatToken(dailyOutput, 4)} WNS</dd>
              </div>
              <div>
                <dt>可提余额</dt>
                <dd>{formatToken(availableReward, 6)} WNS</dd>
              </div>
            </dl>
            <button className="wide-button" type="button" onClick={buyMiner}>
              <Pickaxe size={18} />
              增加 100 WNS 矿机
            </button>
          </article>

          <article className="panel">
            <PanelTitle icon={<ArrowDownToLine size={22} />} kicker="WITHDRAW" title="提币" />
            <div className="gate-status">
              <LockKeyhole size={18} />
              <span>
                {machineCount >= TOKENOMICS.withdrawMachineGate
                  ? '提币条件已满足'
                  : `至少需要 ${TOKENOMICS.withdrawMachineGate} 台矿机`}
              </span>
            </div>
            <div className="input-row single">
              <input
                value={withdrawAmount}
                onChange={(event) => setWithdrawAmount(event.target.value)}
                placeholder="提币数量"
                inputMode="decimal"
              />
            </div>
            <dl className="data-list compact">
              <div>
                <dt>手续费</dt>
                <dd>{formatToken(withdrawFee)} WNS</dd>
              </div>
              <div>
                <dt>预计到账</dt>
                <dd>{formatToken(withdrawNet)} WNS</dd>
              </div>
            </dl>
            <button className="wide-button" type="button" onClick={withdraw}>
              <ArrowDownToLine size={18} />
              提币申请
            </button>
          </article>
        </section>

        <section className="generation-section">
          <div className="section-heading">
            <PanelTitle icon={<Users size={22} />} kicker="REFERRAL" title="九代收益机制" />
            <div className="invite-control">
              <span>直推 {directCount}/9 人</span>
              <button type="button" onClick={() => setDirectCount((value) => Math.min(value + 1, 9))}>
                增加直推
              </button>
            </div>
          </div>
          <div className="generation-grid">
            {TOKENOMICS.referralRates.map((rate, index) => {
              const unlocked = index < unlockedGenerationCount
              return (
                <article className={unlocked ? 'generation active' : 'generation'} key={`generation-${rate}-${index}`}>
                  <span>{index + 1}代</span>
                  <strong>{rate}%</strong>
                  <small>{unlocked ? '已解锁' : '待直推'}</small>
                </article>
              )
            })}
          </div>
          <div className="referral-summary">
            <span>九代收益比例：{referralBonusRate}%</span>
            <span>团队日收益预估：{formatToken(teamDailyReward, 4)} WNS</span>
          </div>
        </section>

        <section className="admin-grid">
          <article className="panel">
            <PanelTitle icon={<Settings size={22} />} kicker="ADMIN" title="运营参数" />
            <div className="setting-row">
              <div>
                <span>提币手续费</span>
                <strong>{feeRate}%</strong>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                step="1"
                value={feeRate}
                onChange={(event) => setFeeRate(Number(event.target.value))}
              />
            </div>
            <div className="button-pair">
              <button type="button" onClick={() => setFeeRate(TOKENOMICS.defaultWithdrawFee)}>
                恢复 50%
              </button>
              <button type="button" onClick={() => setLaunchAt(Date.now())}>
                正式开启头矿
              </button>
            </div>
          </article>

          <article className="panel status-panel">
            <PanelTitle icon={<Clock3 size={22} />} kicker="STATUS" title="链上状态" />
            <dl className="data-list compact">
              <div>
                <dt>钱包</dt>
                <dd>{shortAddress(wallet.address)}</dd>
              </div>
              <div>
                <dt>矿池进度</dt>
                <dd>{formatToken(liquidityProgress)}%</dd>
              </div>
              <div>
                <dt>最新记录</dt>
                <dd>{latestTx}</dd>
              </div>
            </dl>
          </article>
        </section>
      </main>
    </div>
  )
}
