import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  getSupabaseClient,
  getSavedSupabaseConfig,
  saveSupabaseConfig,
  getAuthenticatedSupabaseUser,
  signInSupabaseWithPassword,
  signOutSupabase,
} from '../lib/supabase'

const LS_PRODUCTS_KEY = 'hortigestao_summer_products_v5'
const LS_LOSSES_KEY = 'hortigestao_summer_losses_v5'
const LS_ORDER_SEL_KEY = 'hortigestao_summer_order_sel_v5'

export const HORTI_LOGO_URL = './logo-hortigestao.svg'
export const SUMMER_LOGO_URL = './summer-logo-store.png'
export const PROFILE_AVATAR_URL = './images/avatar.jpg'

const IMAGE_BY_NAME = {
  'tomate italiano': './images/tomate.jpg',
  'alface crespa': './images/alface.jpg',
  'banana prata': './images/banana.jpg',
  'morango bandeja': './images/morango.jpg',
  'cenoura nantes': './images/cenoura.jpg',
  'mamão formosa': './images/mamao.jpg',
  'mamao formosa': './images/mamao.jpg',
}

export const INITIAL_STITCH_PRODUCTS = [
  {
    id: '1',
    name: 'Tomate Italiano',
    emoji: '🍅',
    category: 'legumes',
    categoryLabel: 'Legume',
    qty: 45,
    unit: 'kg',
    unitLabel: 'kg',
    costPrice: 3.5,
    salePrice: 6.5,
    shelfLifeDays: 5,
    status: 'ok',
    statusBadge: 'OK',
    subtitle: 'Legume • Validade: 5 dias',
    lotCode: '#3842',
    image: './images/tomate.jpg',
  },
  {
    id: '2',
    name: 'Alface Crespa',
    emoji: '🥬',
    category: 'verduras',
    categoryLabel: 'Verdura',
    qty: 12,
    unit: 'un',
    unitLabel: 'maços',
    costPrice: 1.5,
    salePrice: 3.2,
    shelfLifeDays: 1,
    status: 'warning',
    statusBadge: '1 dia restante',
    subtitle: 'Verdura • Alerta de Validade',
    lotCode: '#9942',
    image: './images/alface.jpg',
  },
  {
    id: '3',
    name: 'Banana Prata',
    emoji: '🍌',
    category: 'frutas',
    categoryLabel: 'Fruta',
    qty: 80,
    unit: 'kg',
    unitLabel: 'kg',
    costPrice: 2.8,
    salePrice: 4.8,
    shelfLifeDays: 4,
    status: 'ok',
    statusBadge: 'OK',
    subtitle: 'Fruta • Validade: 4 dias',
    lotCode: '#4120',
    image: './images/banana.jpg',
  },
  {
    id: '4',
    name: 'Morango Bandeja',
    emoji: '🍓',
    category: 'frutas',
    categoryLabel: 'Fruta',
    qty: 6,
    unit: 'un',
    unitLabel: 'bandejas',
    costPrice: 5.0,
    salePrice: 8.0,
    shelfLifeDays: 0,
    status: 'critical',
    statusBadge: 'Vence Hoje',
    subtitle: 'Fruta • Ação Recomendada',
    lotCode: '#5012',
    image: './images/morango.jpg',
  },
  {
    id: '5',
    name: 'Cenoura Nantes',
    emoji: '🥕',
    category: 'legumes',
    categoryLabel: 'Legume',
    qty: 60,
    unit: 'kg',
    unitLabel: 'kg',
    costPrice: 2.3,
    salePrice: 4.2,
    shelfLifeDays: 7,
    status: 'ok',
    statusBadge: 'OK',
    subtitle: 'Legume • Em estoque normal',
    lotCode: '#6210',
    image: './images/cenoura.jpg',
  },
  {
    id: '6',
    name: 'Mamão Formosa',
    emoji: '🍈',
    category: 'frutas',
    categoryLabel: 'Fruta',
    qty: 28,
    unit: 'kg',
    unitLabel: 'kg',
    costPrice: 3.2,
    salePrice: 5.99,
    shelfLifeDays: 2,
    status: 'warning',
    statusBadge: 'Maturação Rápida',
    subtitle: 'Fruta • Bancada principal',
    lotCode: '#8819',
    image: './images/mamao.jpg',
  },
]

export const INITIAL_LOSSES = [
  {
    id: '104',
    monthShort: 'NOV',
    day: '11',
    productName: 'Tomate Italiano',
    qtyLabel: '4.5 kg',
    qtyVal: 4.5,
    reasonTitle: 'Avariado no descarregamento',
    reasonIcon: 'local_shipping',
    reasonColor: 'text-secondary',
    costValue: 29.25,
    codeLabel: 'Baixa #104',
  },
  {
    id: '103',
    monthShort: 'NOV',
    day: '10',
    productName: 'Morango Bandeja',
    qtyLabel: '3 unid',
    qtyVal: 3,
    reasonTitle: 'Fungo / Vencimento',
    reasonIcon: 'pest_control',
    reasonColor: 'text-tertiary',
    costValue: 24.0,
    codeLabel: 'Baixa #103',
  },
  {
    id: '102',
    monthShort: 'NOV',
    day: '09',
    productName: 'Rúcula Hidropônica',
    qtyLabel: '5 maços',
    qtyVal: 5,
    reasonTitle: 'Desidratação / Murchamento',
    reasonIcon: 'water_drop',
    reasonColor: 'text-on-surface-variant',
    costValue: 17.5,
    codeLabel: 'Baixa #102',
  },
]

function mapDbRowToProduct(row) {
  const catMap = {
    frutas: 'Fruta',
    verduras: 'Verdura',
    legumes: 'Legume',
  }
  const catLabel = catMap[row.category] || 'Hortifrúti'
  const days = Number(row.shelf_life_days ?? 5)
  const status = row.status || (days <= 0 ? 'critical' : days <= 2 ? 'warning' : 'ok')
  const statusBadge =
    status === 'critical'
      ? 'Vence Hoje'
      : status === 'warning'
        ? `${days} dia(s) restante(s)`
        : 'OK'
  const lowerName = (row.name || '').trim().toLowerCase()

  return {
    id: String(row.id),
    name: row.name,
    emoji: row.emoji || '🥬',
    category: row.category || 'legumes',
    categoryLabel: catLabel,
    qty: Number(row.current_stock ?? 0),
    unit: row.unit || 'kg',
    unitLabel:
      row.unit === 'un' && lowerName.includes('alface')
        ? 'maços'
        : row.unit === 'un' && lowerName.includes('morango')
          ? 'bandejas'
          : row.unit === 'cx'
            ? 'caixas'
            : row.unit || 'kg',
    costPrice: Number(row.cost_price ?? 0),
    salePrice: Number(row.sale_price ?? 0),
    shelfLifeDays: days,
    status,
    statusBadge,
    subtitle: `${catLabel} • Validade: ${days} dia(s)`,
    lotCode: row.lot_code || '#3842',
    image: IMAGE_BY_NAME[lowerName] || './images/tomate.jpg',
  }
}

export const useFlvStore = defineStore('flv', () => {
  const products = ref([])
  const losses = ref([])
  const orderSelection = ref({})
  const isSupabaseConnected = ref(false)
  const authUser = ref(null)
  const isAuthReady = ref(false)
  const toast = ref({ show: false, title: '', desc: '', icon: 'check_circle' })

  const hasSupabaseEndpoint = computed(() => {
    const cfg = getSavedSupabaseConfig()
    return Boolean(cfg.url && cfg.anonKey)
  })

  function showToast(title, desc = '', icon = 'check_circle') {
    toast.value = { show: true, title, desc, icon }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25)
    }
    clearTimeout(window._hortiToastTimer)
    window._hortiToastTimer = setTimeout(() => {
      toast.value.show = false
    }, 2800)
  }

  function hideToast() {
    toast.value.show = false
  }

  function saveState() {
    localStorage.setItem(LS_PRODUCTS_KEY, JSON.stringify(products.value))
    localStorage.setItem(LS_LOSSES_KEY, JSON.stringify(losses.value))
    localStorage.setItem(LS_ORDER_SEL_KEY, JSON.stringify(orderSelection.value))
  }

  async function syncFromSupabase() {
    const client = getSupabaseClient()
    const user = await getAuthenticatedSupabaseUser()
    if (!client || !user?.id) return

    const { data, error } = await client
      .from('flv_products')
      .select('*')
      .order('created_at', { ascending: true })

    if (!error && Array.isArray(data) && data.length > 0) {
      products.value = data.map(mapDbRowToProduct)
      const currentSel = orderSelection.value || {}
      if (Object.keys(currentSel).length === 0) {
        const nextSel = {}
        products.value.slice(0, 3).forEach((p) => {
          nextSel[p.id] = { selected: true, orderQty: 4, orderUnit: 'cx', calcNote: '' }
        })
        orderSelection.value = nextSel
      }
      saveState()
    }
  }

  async function refreshAuthSession() {
    try {
      const client = getSupabaseClient()
      if (!client) {
        isSupabaseConnected.value = false
        authUser.value = null
        return null
      }
      const user = await getAuthenticatedSupabaseUser()
      authUser.value = user
      isSupabaseConnected.value = !!user
      if (user) {
        await syncFromSupabase()
      }
      return user
    } finally {
      isAuthReady.value = true
    }
  }

  function initStore() {
    try {
      const p = localStorage.getItem(LS_PRODUCTS_KEY)
      const l = localStorage.getItem(LS_LOSSES_KEY)
      const s = localStorage.getItem(LS_ORDER_SEL_KEY)

      products.value = p ? JSON.parse(p) : structuredClone(INITIAL_STITCH_PRODUCTS)
      losses.value = l ? JSON.parse(l) : structuredClone(INITIAL_LOSSES)
      if (s) {
        orderSelection.value = JSON.parse(s)
      } else {
        orderSelection.value = {
          '1': { selected: true, orderQty: 5, orderUnit: 'cx', calcNote: '' },
          '2': { selected: true, orderQty: 3, orderUnit: 'engradados', calcNote: '' },
          '4': { selected: true, orderQty: 4, orderUnit: 'cx', calcNote: '' },
        }
      }
      saveState()
    } catch {
      products.value = structuredClone(INITIAL_STITCH_PRODUCTS)
      losses.value = structuredClone(INITIAL_LOSSES)
    }

    refreshAuthSession()
  }

  async function configureSupabase(url, anonKey) {
    const client = saveSupabaseConfig(url, anonKey)
    if (!client) {
      isSupabaseConnected.value = false
      authUser.value = null
      showToast('Modo Local Ativo', 'Dados salvos apenas neste aparelho.')
      return false
    }
    await refreshAuthSession()
    showToast(
      authUser.value ? 'Supabase Autenticado!' : 'Endpoint salvo!',
      authUser.value
        ? `Conectado como ${authUser.value.email}`
        : 'Agora faça login com e-mail e senha para sincronizar.'
    )
    return true
  }

  async function loginSupabase(email, password) {
    const { user, error } = await signInSupabaseWithPassword(email, password)
    if (error || !user) {
      isSupabaseConnected.value = false
      authUser.value = null
      return { ok: false, error: error || 'Credenciais inválidas' }
    }
    authUser.value = user
    isSupabaseConnected.value = true
    await syncFromSupabase()
    showToast('Sessão autenticada!', `Acesso liberado para ${user.email}`)
    return { ok: true, error: null }
  }

  async function logoutSupabase() {
    await signOutSupabase()
    authUser.value = null
    isSupabaseConnected.value = false
    showToast('Sessão encerrada', 'Acesso em nuvem bloqueado para não autenticados.')
  }

  async function updateStock(productId, delta) {
    const item = products.value.find((p) => p.id === productId)
    if (!item) return
    item.qty = Math.max(0, Number((Number(item.qty) + delta).toFixed(1)))
    saveState()
    showToast(`Estoque atualizado: ${item.qty} ${item.unitLabel}`)

    const client = getSupabaseClient()
    const user = await getAuthenticatedSupabaseUser()
    if (client && user?.id && productId.length > 10) {
      await client
        .from('flv_products')
        .update({ current_stock: item.qty, updated_at: new Date().toISOString() })
        .eq('id', productId)
    }
  }

  async function setExactStock(productId, newQty, calcSummary = '') {
    const item = products.value.find((p) => p.id === productId)
    if (!item) return
    item.qty = Math.max(0, Number(Number(newQty).toFixed(2)))
    if (calcSummary) {
      item.subtitle = `${item.categoryLabel} • ${calcSummary}`
    }
    saveState()
    showToast(
      `Peso aplicado em ${item.name}: ${item.qty} ${item.unitLabel}`,
      calcSummary || 'Saldo atualizado pela calculadora'
    )

    const client = getSupabaseClient()
    const user = await getAuthenticatedSupabaseUser()
    if (client && user?.id && productId.length > 10) {
      await client
        .from('flv_products')
        .update({ current_stock: item.qty, updated_at: new Date().toISOString() })
        .eq('id', productId)
    }
  }

  function toggleOrderSelect(product) {
    const curr = orderSelection.value[product.id]
    if (curr && curr.selected) {
      curr.selected = false
    } else {
      orderSelection.value[product.id] = {
        selected: true,
        orderQty: curr?.orderQty || 4,
        orderUnit: curr?.orderUnit || (product.unit === 'un' ? 'cx' : 'cx'),
        calcNote: curr?.calcNote || '',
      }
    }
    saveState()
  }

  function updateOrderItemQty(productId, delta) {
    const curr = orderSelection.value[productId]
    if (!curr) return
    curr.orderQty = Math.max(1, Number((Number(curr.orderQty || 1) + delta).toFixed(1)))
    saveState()
  }

  async function addProduct({
    name,
    category,
    unit,
    qty,
    costPrice,
    salePrice,
    shelfLifeDays,
    includeInOrder = true,
    calcNote = '',
  }) {
    const catMap = {
      frutas: { label: 'Fruta', emoji: '🍎' },
      verduras: { label: 'Verdura', emoji: '🥬' },
      legumes: { label: 'Legume', emoji: '🥕' },
    }
    const meta = catMap[category] || catMap.legumes
    const unitLabelMap = { kg: 'kg', un: 'un', cx: 'caixas' }

    const created = {
      id: String(Date.now()),
      name: name.trim(),
      emoji: meta.emoji,
      category,
      categoryLabel: meta.label,
      qty: Number(qty || 0),
      unit,
      unitLabel: unitLabelMap[unit] || unit,
      costPrice: Number(costPrice || 0),
      salePrice: Number(salePrice || 0),
      shelfLifeDays: Number(shelfLifeDays || 5),
      status: shelfLifeDays <= 1 ? 'critical' : shelfLifeDays <= 2 ? 'warning' : 'ok',
      statusBadge:
        shelfLifeDays <= 1
          ? 'Vence Hoje'
          : shelfLifeDays <= 2
            ? `${shelfLifeDays} dias`
            : 'OK',
      subtitle: calcNote
        ? `${meta.label} • ${calcNote}`
        : `${meta.label} • Validade: ${shelfLifeDays} dias`,
      lotCode: `#${Math.floor(1000 + Math.random() * 8999)}`,
      image: INITIAL_STITCH_PRODUCTS[0].image,
    }

    const client = getSupabaseClient()
    const verifiedUser = await getAuthenticatedSupabaseUser()
    if (client && verifiedUser?.id) {
      const { data } = await client
        .from('flv_products')
        .insert([
          {
            name: created.name,
            emoji: created.emoji,
            category: created.category,
            unit: created.unit,
            current_stock: created.qty,
            cost_price: created.costPrice,
            sale_price: created.salePrice,
            shelf_life_days: created.shelfLifeDays,
            lot_code: created.lotCode,
            status: created.status,
            created_by: verifiedUser.id,
          },
        ])
        .select('*')
        .single()
      if (data?.id) {
        created.id = String(data.id)
      }
    }

    products.value.unshift(created)

    if (includeInOrder) {
      orderSelection.value[created.id] = {
        selected: true,
        orderQty: Number(qty || 1),
        orderUnit: unit === 'cx' ? 'cx' : unit,
        calcNote,
      }
    }

    saveState()
    return created
  }

  async function registerWriteOff({ productId, qty, reasonKey, destination, notes }) {
    const prod = products.value.find((p) => p.id === productId)
    if (!prod) return

    const deduct = Math.min(prod.qty, Number(qty || 0))
    prod.qty = Math.max(0, Number((prod.qty - deduct).toFixed(2)))

    const reasonLabels = {
      maturacao: { title: 'Maturação excessiva', icon: 'nest_eco_leaf', color: 'text-tertiary' },
      pragas: { title: 'Fungo / Vencimento', icon: 'pest_control', color: 'text-error' },
      dano: { title: 'Dano físico / Transporte', icon: 'local_shipping', color: 'text-secondary' },
      murcha: { title: 'Desidratação / Murcha', icon: 'water_drop', color: 'text-on-surface-variant' },
      inventario: { title: 'Ajuste de balanço físico', icon: 'difference', color: 'text-on-surface-variant' },
    }
    const rMeta = reasonLabels[reasonKey] || reasonLabels.maturacao
    const costValue = Number((deduct * (prod.salePrice || 5)).toFixed(2))

    const nextNum = 105 + losses.value.length
    losses.value.unshift({
      id: String(nextNum),
      monthShort: 'NOV',
      day: String(new Date().getDate()).padStart(2, '0'),
      productName: prod.name,
      qtyLabel: `${deduct} ${prod.unitLabel}`,
      qtyVal: deduct,
      reasonTitle: notes ? `${rMeta.title} (${notes})` : rMeta.title,
      reasonIcon: rMeta.icon,
      reasonColor: rMeta.color,
      costValue,
      codeLabel: `Baixa #${nextNum}`,
      destination,
    })

    saveState()
    showToast('Baixa concluída!', `Estoque de ${prod.name} atualizado.`, 'done_all')

    const client = getSupabaseClient()
    const user = await getAuthenticatedSupabaseUser()
    if (client && user?.id && productId.length > 10) {
      await client
        .from('flv_products')
        .update({ current_stock: prod.qty, updated_at: new Date().toISOString() })
        .eq('id', productId)
      await client.from('flv_movements').insert([
        {
          product_id: productId,
          movement_type: 'DESCARTE',
          gross_weight: deduct,
          net_quantity: deduct,
          stock_after: prod.qty,
          waste_reason: rMeta.title,
          destination,
          unit_cost_at_time: prod.salePrice || 0,
          notes: notes || '',
          created_by: user.id,
        },
      ])
    }
  }

  const totalStockKg = computed(() =>
    Math.round(products.value.reduce((acc, p) => acc + Number(p.qty || 0), 0))
  )

  const totalEstimatedValue = computed(() =>
    Math.round(
      products.value.reduce((acc, p) => acc + Number(p.qty || 0) * Number(p.salePrice || 0), 0)
    )
  )

  const totalLossMonthBrl = computed(() =>
    losses.value.reduce((acc, l) => acc + Number(l.costValue || 0), 0)
  )

  const totalLossMonthKg = computed(() =>
    Number(losses.value.reduce((acc, l) => acc + Number(l.qtyVal || 0), 0).toFixed(1))
  )

  const selectedOrderItems = computed(() => {
    const list = []
    for (const p of products.value) {
      const sel = orderSelection.value[p.id]
      if (sel && sel.selected) {
        list.push({
          product: p,
          orderQty: sel.orderQty,
          orderUnit: sel.orderUnit,
          calcNote: sel.calcNote,
        })
      }
    }
    return list
  })

  function generateWhatsAppMessage(reportType = 'compras', activeCats = ['frutas', 'verduras', 'legumes']) {
    const dateStr = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

    if (reportType === 'perdas') {
      const lines = [
        `📊 *HORTIGESTÃO SUMMER FONSECA — RELATÓRIO DE PERDAS*`,
        `📅 ${dateStr}`,
        `-----------------------------------------`,
      ]
      for (const l of losses.value) {
        lines.push(`• *${l.productName}:* ${l.qtyLabel} — ${l.reasonTitle} (-R$ ${l.costValue.toFixed(2)})`)
      }
      lines.push(`-----------------------------------------`)
      lines.push(`💰 *Total Perdas:* R$ ${totalLossMonthBrl.value.toFixed(2)} (${totalLossMonthKg.value} kg)`)
      return lines.join('\n')
    }

    if (reportType === 'inventario') {
      const filtered = products.value.filter((p) => activeCats.includes(p.category))
      const lines = [
        `📦 *HORTIGESTÃO SUMMER FONSECA — INVENTÁRIO ATUAL*`,
        `📅 ${dateStr}`,
        `-----------------------------------------`,
      ]
      for (const p of filtered) {
        lines.push(`• ${p.emoji} *${p.name}:* ${p.qty} ${p.unitLabel} (${p.statusBadge})`)
      }
      return lines.join('\n')
    }

    const items = selectedOrderItems.value.filter((item) =>
      activeCats.includes(item.product.category)
    )
    const lines = [
      `🛒 *SUMMER FONSECA — LISTA DE PEDIDO HORTIFRÚTI*`,
      `📅 ${dateStr}`,
      `-----------------------------------------`,
    ]
    if (items.length === 0) {
      lines.push(`(Nenhum item selecionado na lista)`)
    } else {
      for (const item of items) {
        const extra = item.calcNote ? ` _(${item.calcNote})_` : ''
        lines.push(
          `• ${item.product.emoji} *${item.product.name}:* ${item.orderQty} ${item.orderUnit}${extra}`
        )
      }
    }
    return lines.join('\n')
  }

  return {
    products,
    losses,
    orderSelection,
    isSupabaseConnected,
    authUser,
    isAuthReady,
    hasSupabaseEndpoint,
    toast,
    totalStockKg,
    totalEstimatedValue,
    totalLossMonthBrl,
    totalLossMonthKg,
    selectedOrderItems,
    showToast,
    hideToast,
    saveState,
    initStore,
    configureSupabase,
    loginSupabase,
    logoutSupabase,
    syncFromSupabase,
    getSavedSupabaseConfig,
    updateStock,
    setExactStock,
    toggleOrderSelect,
    updateOrderItemQty,
    addProduct,
    registerWriteOff,
    generateWhatsAppMessage,
  }
})
