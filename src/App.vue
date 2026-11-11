<script setup>
import { ref, computed } from 'vue'
import {
  useFlvStore,
  HORTI_LOGO_URL,
  SUMMER_LOGO_URL,
  PROFILE_AVATAR_URL,
} from './stores/useFlvStore'
import SupabaseConfigModal from './components/SupabaseConfigModal.vue'

const store = useFlvStore()
store.initStore()

// ============================================================================
// NAVEGAÇÃO ENTRE AS 5 TELAS DO ARQUIVO STITCH
// 'estoque' | 'cadastrar' | 'perdas' | 'registrar_baixa' | 'exportar'
// ============================================================================
const currentScreen = ref('estoque')
const showSupabaseModal = ref(false)

// ============================================================================
// TELA 1: ESTOQUE / PRODUTOS (estoque_produtos/code.html)
// ============================================================================
const searchQuery = ref('')
const activeCategoryFilter = ref('todos') // 'todos' | 'frutas' | 'verduras' | 'legumes'
const openMenuProductId = ref(null)
const sortAsc = ref(true)

const categoryCounts = computed(() => ({
  todos: store.products.length,
  frutas: store.products.filter((p) => p.category === 'frutas').length,
  verduras: store.products.filter((p) => p.category === 'verduras').length,
  legumes: store.products.filter((p) => p.category === 'legumes').length,
}))

const criticalCount = computed(
  () => store.products.filter((p) => p.status === 'critical' || p.status === 'warning').length
)

const filteredProducts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const list = store.products.filter((p) => {
    const matchCat =
      activeCategoryFilter.value === 'todos' || p.category === activeCategoryFilter.value
    const matchQ = !q || p.name.toLowerCase().includes(q)
    return matchCat && matchQ
  })
  return [...list].sort((a, b) =>
    sortAsc.value ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
  )
})

function toggleItemMenu(productId) {
  openMenuProductId.value = openMenuProductId.value === productId ? null : productId
}

function filterCriticalOnly() {
  activeCategoryFilter.value = 'todos'
  searchQuery.value = ''
  store.showToast(
    `Exibindo ${criticalCount.value} itens com atenção de validade`,
    'Verifique Alface, Morango e Mamão',
    'priority_high'
  )
}

function openRegisterLossForProduct(product) {
  lossTargetProductId.value = product.id
  lossQuantity.value = Math.min(3.5, product.qty || 1)
  openMenuProductId.value = null
  currentScreen.value = 'registrar_baixa'
}

// ============================================================================
// CALCULADORA DE BALANÇA & TARA OPCIONAL (Integrada em Cadastrar, Estoque e Baixa)
// ============================================================================
const showScaleCalcModal = ref(false)
const calcContext = ref({ mode: 'cadastrar', product: null }) // 'cadastrar' | 'estoque' | 'pedido' | 'baixa'
const calcWeightInput = ref('')
const calcBatches = ref([])
const calcCratesCount = ref(1)
const calcTarePerCrate = ref(0)

function openScaleCalculator(mode = 'cadastrar', product = null) {
  calcContext.value = { mode, product }
  calcWeightInput.value = ''
  calcBatches.value = []
  calcCratesCount.value = 1
  calcTarePerCrate.value = 0
  showScaleCalcModal.value = true
}

function addCalcBatch() {
  const w = parseFloat(String(calcWeightInput.value).replace(',', '.'))
  if (!w || w <= 0) return
  calcBatches.value.push(Number(w.toFixed(2)))
  calcWeightInput.value = ''
}

function removeCalcBatch(idx) {
  calcBatches.value.splice(idx, 1)
}

const calcGrossWeight = computed(() => {
  const pending = parseFloat(String(calcWeightInput.value).replace(',', '.')) || 0
  const sum = calcBatches.value.reduce((acc, n) => acc + n, 0) + (pending > 0 ? pending : 0)
  return Number(sum.toFixed(2))
})

const calcTotalTare = computed(() => {
  const t = parseFloat(String(calcTarePerCrate.value).replace(',', '.')) || 0
  const c = Math.max(0, parseInt(calcCratesCount.value, 10) || 0)
  return Number((t * c).toFixed(2))
})

const calcNetWeight = computed(() =>
  Number(Math.max(0, calcGrossWeight.value - calcTotalTare.value).toFixed(2))
)

function applyCalculatorResult() {
  if (calcNetWeight.value <= 0) return
  const summary =
    calcTotalTare.value > 0
      ? `Bruto ${calcGrossWeight.value}kg - Tara ${calcTotalTare.value}kg`
      : `${calcNetWeight.value}kg na balança`

  if (calcContext.value.mode === 'cadastrar') {
    newProdQty.value = calcNetWeight.value
    newProdUnit.value = 'kg'
    newProdCalcNote.value = summary
    store.showToast(`Peso líquido ${calcNetWeight.value} kg preenchido no cadastro!`)
  } else if (calcContext.value.mode === 'baixa') {
    lossQuantity.value = calcNetWeight.value
    store.showToast(`Peso líquido ${calcNetWeight.value} kg preenchido na baixa!`)
  } else if (calcContext.value.product) {
    const p = calcContext.value.product
    store.setExactStock(p.id, calcNetWeight.value, summary)
    if (store.orderSelection[p.id]) {
      store.orderSelection[p.id].calcNote = summary
    }
  }
  showScaleCalcModal.value = false
}

// ============================================================================
// TELA 2: CADASTRAR PRODUTO (cadastrar_produto/code.html)
// ============================================================================
const newProdCategory = ref('frutas')
const newProdName = ref('')
const newProdUnit = ref('kg')
const newProdQty = ref(25)
const newProdCost = ref(3.5)
const newProdSale = ref(6.9)
const newProdIncludeOrder = ref(true)
const newProdCalcNote = ref('')

const todayStr = new Date().toISOString().split('T')[0]
const nextWeekDate = new Date()
nextWeekDate.setDate(nextWeekDate.getDate() + 5)
const newProdHarvestDate = ref(todayStr)
const newProdExpiryDate = ref(nextWeekDate.toISOString().split('T')[0])
const newProdPreventionAlert = ref(true)

const quickSuggestions = [
  { label: 'Tomate Carmem', cat: 'legumes' },
  { label: 'Maçã Gala', cat: 'frutas' },
  { label: 'Rúcula Hidropônica', cat: 'verduras' },
  { label: 'Batata Inglesa', cat: 'legumes' },
]

function selectSuggestionChip(chip) {
  newProdName.value = chip.label
  newProdCategory.value = chip.cat
}

function adjustNewProdQty(delta) {
  newProdQty.value = Math.max(1, Number((Number(newProdQty.value || 0) + delta).toFixed(1)))
}

const newProdProfitSpread = computed(() => {
  const diff = Number(newProdSale.value || 0) - Number(newProdCost.value || 0)
  return diff.toFixed(2).replace('.', ',')
})

const newProdMarginPct = computed(() => {
  const c = Number(newProdCost.value || 0)
  const s = Number(newProdSale.value || 0)
  if (c <= 0) return s > 0 ? 100 : 0
  return Math.round(((s - c) / c) * 100)
})

const newProdShelfLifeDays = computed(() => {
  const h = new Date(newProdHarvestDate.value)
  const e = new Date(newProdExpiryDate.value)
  if (isNaN(h) || isNaN(e)) return 5
  return Math.ceil((e - h) / (1000 * 60 * 60 * 24))
})

const newProdPreviewSummary = computed(() => {
  const q = Number(newProdQty.value || 0)
  const totalCost = (q * Number(newProdCost.value || 0)).toFixed(2).replace('.', ',')
  const totalSale = (q * Number(newProdSale.value || 0)).toFixed(2).replace('.', ',')
  return `${q} ${newProdUnit.value} • Custo Total R$ ${totalCost} • Venda Estimada R$ ${totalSale}`
})

function handleSaveProduct(andAnother = false) {
  const finalName = newProdName.value.trim() || 'Tomate Carmem Especial'
  store.addProduct({
    name: finalName,
    category: newProdCategory.value,
    unit: newProdUnit.value,
    qty: newProdQty.value,
    costPrice: newProdCost.value,
    salePrice: newProdSale.value,
    shelfLifeDays: Math.max(1, newProdShelfLifeDays.value),
    includeInOrder: newProdIncludeOrder.value,
    calcNote: newProdCalcNote.value,
  })

  if (andAnother) {
    store.showToast(`"${finalName}" salvo! Pronto para o próximo.`)
    newProdName.value = ''
    newProdQty.value = 20
    newProdCalcNote.value = ''
  } else {
    store.showToast(
      `"${finalName}" adicionado ao inventário!`,
      'Estoque atualizado e item disponível para lista.'
    )
    currentScreen.value = 'estoque'
  }
}

// ============================================================================
// TELA 3 & 5: CONTROLE DE PERDAS & REGISTRAR BAIXA (registrar_baixa_de_perda)
// ============================================================================
const lossTargetProductId = ref('1')
const lossQuantity = ref(3.5)
const lossReason = ref('maturacao')
const lossDestination = ref('compostagem')
const lossNotes = ref('')
const lossPhotoPreview = ref('')
const showConfirmLossModal = ref(false)

const currentLossProduct = computed(
  () => store.products.find((p) => p.id === lossTargetProductId.value) || store.products[0]
)

const estimatedLossCostBrl = computed(() => {
  const p = currentLossProduct.value
  const price = p ? Number(p.salePrice || 6.5) : 6.5
  return (Number(lossQuantity.value || 0) * price).toFixed(2).replace('.', ',')
})

const remainingStockAfterLoss = computed(() => {
  const p = currentLossProduct.value
  const avail = p ? Number(p.qty || 0) : 0
  return Math.max(0, avail - Number(lossQuantity.value || 0)).toFixed(2)
})

function adjustLossQty(delta) {
  const maxAvail = currentLossProduct.value?.qty || 45
  let next = Math.round((Number(lossQuantity.value || 0) + delta) * 10) / 10
  if (next < 0.1) next = 0.1
  if (next > maxAvail) next = maxAvail
  lossQuantity.value = Number(next.toFixed(1))
}

function handleLossPhotoUpload(e) {
  const file = e.target.files?.[0]
  if (file) {
    lossPhotoPreview.value = URL.createObjectURL(file)
  }
}

function executeFinalLoss() {
  store.registerWriteOff({
    productId: currentLossProduct.value.id,
    qty: lossQuantity.value,
    reasonKey: lossReason.value,
    destination: lossDestination.value,
    notes: lossNotes.value,
  })
  showConfirmLossModal.value = false
  lossNotes.value = ''
  currentScreen.value = 'perdas'
}

// ============================================================================
// TELA 4: EXPORTAR LISTA & RELATÓRIOS (exportar_lista_relat_rios/code.html)
// ============================================================================
const selectedReportType = ref('compras') // 'compras' | 'inventario' | 'perdas' | 'validades'
const selectedPeriod = ref('7d')
const activeExportCategories = ref(['frutas', 'verduras', 'legumes'])
const selectedOutputFormat = ref('whatsapp') // 'whatsapp' | 'pdf' | 'excel'

function toggleExportCategory(cat) {
  if (activeExportCategories.value.includes(cat)) {
    if (activeExportCategories.value.length > 1) {
      activeExportCategories.value = activeExportCategories.value.filter((c) => c !== cat)
    }
  } else {
    activeExportCategories.value.push(cat)
  }
}

function resetExportFilters() {
  activeExportCategories.value = ['frutas', 'verduras', 'legumes']
  selectedPeriod.value = '7d'
  store.showToast('Filtros Restaurados', 'Exibindo todos os departamentos.')
}

const previewWhatsAppText = computed(() =>
  store.generateWhatsAppMessage(selectedReportType.value, activeExportCategories.value)
)

async function handleCopyOrDownload() {
  const text = previewWhatsAppText.value
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // fallback
  }

  if (selectedOutputFormat.value === 'whatsapp') {
    store.showToast(
      'Texto Copiado para Área de Transferência!',
      'Cole a lista de pedido em qualquer conversa do WhatsApp.'
    )
  } else if (selectedOutputFormat.value === 'pdf') {
    window.print()
  } else {
    // Gera download CSV real!
    const csvLines = ['Produto,Categoria,Estoque Atual,Unidade,Qtd Pedido,Unidade Pedido']
    for (const p of store.products) {
      const sel = store.orderSelection[p.id]
      csvLines.push(
        `"${p.name}","${p.categoryLabel}",${p.qty},"${p.unitLabel}",${sel?.selected ? sel.orderQty : 0},"${sel?.orderUnit || ''}"`
      )
    }
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hortigestao-summer-fonseca-${selectedReportType.value}.csv`
    a.click()
    store.showToast('Planilha CSV Baixada!', 'O arquivo foi salvo nas suas transferências.')
  }
}

async function handleSendWhatsAppDirect() {
  const text = previewWhatsAppText.value
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // ignore
  }
  const encoded = encodeURIComponent(text)
  window.open(`https://wa.me/?text=${encoded}`, '_blank')
  store.showToast(
    'Abrindo WhatsApp...',
    'Lista copiada e formatada para envio rápido!'
  )
}

// ============================================================================
// TELA DE AUTENTICAÇÃO OBRIGATÓRIA (ZERO ACESSO NÃO AUTENTICADO)
// ============================================================================
const gateEmail = ref('oscarmoraes@gmail.com')
const gatePassword = ref('')
const gateError = ref('')
const gateLoading = ref(false)

async function handleGateLogin() {
  gateError.value = ''
  if (!gateEmail.value.trim() || !gatePassword.value) {
    gateError.value = 'Informe seu e-mail e senha autorizados.'
    return
  }
  gateLoading.value = true
  try {
    const res = await store.loginSupabase(gateEmail.value, gatePassword.value)
    if (!res.ok) {
      gateError.value = res.error || 'Acesso negado.'
    } else {
      gatePassword.value = ''
    }
  } finally {
    gateLoading.value = false
  }
}
</script>

<template>
  <!-- ========================================================================
       PORTÃO DE AUTENTICAÇÃO SUPABASE AUTH (BLOQUEIA NÃO AUTENTICADOS)
       ======================================================================== -->
  <div
    v-if="store.hasSupabaseEndpoint && !store.authUser"
    class="bg-surface font-body-md text-body-md text-on-surface min-h-screen flex flex-col items-center justify-center px-4 antialiased"
  >
    <div
      class="w-full max-w-sm bg-surface-container-lowest rounded-2xl p-6 shadow-md border border-outline-variant/30 space-y-5"
    >
      <div class="flex items-center gap-3">
        <img
          alt="Logo Supermercado Summer"
          class="h-11 w-11 rounded-xl object-contain bg-surface-container p-1 shadow-sm border border-outline-variant/20"
          :src="SUMMER_LOGO_URL"
        />
        <img
          alt="Logo HortiGestão"
          class="h-10 w-10 rounded-xl object-contain shadow-sm"
          :src="HORTI_LOGO_URL"
        />
        <div>
          <h1 class="font-headline-md text-headline-md text-primary leading-tight">
            HortiGestão
          </h1>
          <p class="font-label-sm text-label-sm text-on-surface-variant">
            Supermercado Summer • Unidade Fonseca
          </p>
        </div>
      </div>

      <div class="p-3 rounded-xl bg-surface-container-low flex items-start gap-2.5">
        <span class="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">
          verified_user
        </span>
        <p class="font-body-sm text-body-sm text-on-surface-variant">
          Acesso restrito a usuário autenticado. Nenhuma consulta ou operação é permitida sem login.
        </p>
      </div>

      <form class="space-y-3.5" @submit.prevent="handleGateLogin">
        <div>
          <label class="block font-label-md text-label-md text-on-surface mb-1">
            E-mail Autorizado
          </label>
          <input
            v-model="gateEmail"
            type="email"
            required
            autocomplete="username"
            placeholder="oscarmoraes@gmail.com"
            class="w-full h-12 px-4 rounded-xl bg-surface-container font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label class="block font-label-md text-label-md text-on-surface mb-1">
            Senha
          </label>
          <input
            v-model="gatePassword"
            type="password"
            required
            autocomplete="current-password"
            placeholder="Digite sua senha"
            class="w-full h-12 px-4 rounded-xl bg-surface-container font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <p v-if="gateError" class="font-label-md text-label-md text-error">
          {{ gateError }}
        </p>

        <button
          type="submit"
          :disabled="gateLoading"
          class="w-full h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-50"
        >
          <span class="material-symbols-outlined text-[20px]">lock_open</span>
          <span>{{ gateLoading ? 'Autenticando...' : 'Entrar no HortiGestão' }}</span>
        </button>
      </form>
    </div>
  </div>

  <div
    v-else
    class="bg-surface font-body-md text-body-md text-on-surface min-h-screen flex flex-col antialiased"
  >
    <!-- ======================================================================
         HEADER FIXO (IDÊNTICO AO STITCH HORTIGESTÃO)
         ====================================================================== -->
    <header
      class="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-safe"
    >
      <div class="h-16 px-margin-mobile max-w-2xl mx-auto flex items-center justify-between">
        <!-- Se estiver na sub-tela Registrar Baixa, mostra seta Voltar como no Stitch -->
        <div v-if="currentScreen === 'registrar_baixa'" class="flex items-center gap-space-xs">
          <button
            aria-label="Voltar"
            class="w-11 h-11 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container transition-colors -ml-1"
            @click="currentScreen = 'perdas'"
          >
            <span class="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <img
            alt="Logo Supermercado Summer"
            class="h-7 w-7 rounded-lg object-contain bg-surface-container-lowest p-0.5 shadow-sm border border-outline-variant/20"
            :src="SUMMER_LOGO_URL"
          />
          <img alt="Logo HortiGestão" class="h-7 w-7 rounded-lg object-contain shadow-sm" :src="HORTI_LOGO_URL" />
          <h1 class="font-headline-sm text-headline-sm text-on-surface truncate max-w-[180px]">
            Registrar Baixa
          </h1>
        </div>

        <!-- Cabeçalho Padrão das 4 Abas -->
        <div v-else class="flex items-center gap-space-sm">
          <div class="flex items-center gap-1.5">
            <img
              alt="Logo Supermercado Summer"
              class="h-9 w-9 rounded-xl object-contain bg-surface-container-lowest p-0.5 shadow-sm border border-outline-variant/20"
              :src="SUMMER_LOGO_URL"
            />
            <img
              alt="Logo HortiGestão"
              class="h-8 w-8 rounded-xl object-contain shadow-sm"
              :src="HORTI_LOGO_URL"
            />
          </div>
          <div class="flex flex-col">
            <span class="font-headline-sm text-headline-sm text-primary leading-tight tracking-tight">
              HortiGestão
            </span>
            <span class="font-label-sm text-label-sm text-on-surface-variant leading-none">
              {{
                currentScreen === 'estoque'
                  ? 'Estoque • Summer Fonseca'
                  : currentScreen === 'cadastrar'
                    ? 'Cadastrar • Summer Fonseca'
                    : currentScreen === 'perdas'
                      ? 'Perdas • Summer Fonseca'
                      : 'Exportar & Lista WhatsApp'
              }}
            </span>
          </div>
        </div>

        <!-- Ações Direita do Header: Calculadora Rápida + Supabase + Avatar -->
        <div class="flex items-center gap-space-xs">
          <button
            aria-label="Calculadora de Pesagem"
            @click="openScaleCalculator('cadastrar', null)"
            class="h-9 px-2.5 flex items-center gap-1 rounded-full bg-surface-container text-primary hover:bg-surface-container-highest transition-colors"
            title="Calculadora de Balança e Tara"
          >
            <span class="material-symbols-outlined text-[18px]">calculate</span>
            <span class="font-label-sm text-label-sm hidden sm:inline">Calculadora</span>
          </button>

          <button
            aria-label="Conexão Supabase"
            @click="showSupabaseModal = true"
            class="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
            title="Configurar Supabase"
          >
            <span
              class="material-symbols-outlined text-[20px]"
              :class="store.isSupabaseConnected ? 'text-primary' : ''"
            >
              cloud_sync
            </span>
          </button>

          <div class="pl-space-xs flex items-center">
            <img
              alt="Profile"
              class="w-8 h-8 rounded-full object-cover"
              :src="PROFILE_AVATAR_URL"
            />
          </div>
        </div>
      </div>
    </header>

    <!-- ======================================================================
         MAIN CONTAINER (COM AS 5 TELAS DO STITCH)
         ====================================================================== -->
    <main class="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-surface max-w-2xl mx-auto">
      <!-- ====================================================================
           TELA 1: ESTOQUE / PRODUTOS (estoque_produtos/code.html)
           ==================================================================== -->
      <div
        v-if="currentScreen === 'estoque'"
        class="flex flex-col w-full px-margin-mobile pb-8 space-y-space-md"
      >
        <!-- Search & Fast Filters Bar -->
        <section class="flex items-center gap-space-sm pt-space-xs">
          <div class="relative flex-1 flex items-center">
            <span
              class="material-symbols-outlined absolute left-3 text-on-surface-variant text-[20px] pointer-events-none"
            >
              search
            </span>
            <input
              v-model="searchQuery"
              class="w-full h-12 pl-10 pr-10 bg-surface-container rounded-xl font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:bg-surface-container-highest transition-colors shadow-sm"
              placeholder="Buscar fruta, verdura, legume..."
              type="search"
            />
            <button
              aria-label="Calculadora de Balança"
              @click="openScaleCalculator('cadastrar', null)"
              class="absolute right-2 w-8 h-8 rounded-lg flex items-center justify-center text-primary hover:bg-surface-container-highest transition-colors"
              type="button"
              title="Abrir Calculadora"
            >
              <span class="material-symbols-outlined text-[20px]">calculate</span>
            </button>
          </div>
          <button
            aria-label="Ir para Lista de Pedido WhatsApp"
            @click="currentScreen = 'exportar'"
            class="h-12 px-3 flex-shrink-0 flex items-center justify-center gap-1 rounded-xl bg-primary text-on-primary hover:bg-primary-container active:scale-95 transition-all shadow-sm"
            type="button"
            title="Ver Lista de Pedido p/ WhatsApp"
          >
            <span class="material-symbols-outlined text-[20px]">shopping_cart_checkout</span>
            <span class="font-label-md text-label-md font-bold">
              {{ store.selectedOrderItems.length }}
            </span>
          </button>
        </section>

        <!-- Horizontal Scrollable Category Pills -->
        <section class="w-full -mx-margin-mobile px-margin-mobile overflow-x-auto py-1">
          <div class="flex items-center gap-space-xs min-w-max" role="tablist">
            <button
              v-for="tab in [
                { key: 'todos', label: 'Todos', count: categoryCounts.todos },
                { key: 'frutas', label: 'Frutas', count: categoryCounts.frutas },
                { key: 'verduras', label: 'Verduras', count: categoryCounts.verduras },
                { key: 'legumes', label: 'Legumes', count: categoryCounts.legumes },
              ]"
              :key="tab.key"
              @click="activeCategoryFilter = tab.key"
              :class="[
                'px-3.5 py-2 rounded-full font-label-md text-label-md flex items-center gap-1.5 transition-transform active:scale-95',
                activeCategoryFilter === tab.key
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface',
              ]"
              type="button"
            >
              <span>{{ tab.label }}</span>
              <span
                :class="[
                  'px-1.5 py-0.5 rounded-full font-label-sm text-label-sm',
                  activeCategoryFilter === tab.key
                    ? 'bg-on-primary/20 text-on-primary'
                    : 'bg-surface-container-highest text-on-surface-variant',
                ]"
              >
                {{ tab.count }}
              </span>
            </button>
          </div>
        </section>

        <!-- Compact Operational Alert Banner -->
        <section
          class="w-full bg-secondary-fixed/50 rounded-2xl p-space-md flex items-center justify-between shadow-sm relative overflow-hidden"
        >
          <div class="flex items-center gap-space-sm z-10 min-w-0 pr-2">
            <div
              class="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center flex-shrink-0 shadow-sm"
            >
              <span class="material-symbols-outlined text-[22px]">notification_important</span>
            </div>
            <div class="flex flex-col min-w-0">
              <span class="font-label-lg text-label-lg text-on-secondary-fixed font-bold leading-tight truncate">
                Validade Crítica
              </span>
              <p class="font-body-sm text-body-sm text-on-secondary-fixed-variant line-clamp-1">
                {{ criticalCount }} itens exigem atenção imediata
              </p>
            </div>
          </div>
          <button
            @click="filterCriticalOnly"
            class="z-10 flex-shrink-0 px-3.5 py-2 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md shadow-sm active:scale-95 transition-transform flex items-center gap-1"
            type="button"
          >
            <span>Verificar</span>
            <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </section>

        <!-- Metric Snapshot Cards (3-column responsive grid) -->
        <section class="grid grid-cols-3 gap-space-xs">
          <!-- Card 1: Total Estoque -->
          <div class="bg-surface-container-lowest p-3 rounded-2xl flex flex-col justify-between shadow-sm">
            <div
              class="w-7 h-7 rounded-lg bg-surface-container text-primary flex items-center justify-center mb-2"
            >
              <span class="material-symbols-outlined text-[18px]">scale</span>
            </div>
            <div class="flex flex-col">
              <span class="font-label-sm text-label-sm text-on-surface-variant">Estoque Total</span>
              <span class="font-headline-sm text-headline-sm text-on-surface tracking-tight mt-0.5">
                {{ store.totalStockKg }}
                <span class="font-body-sm text-body-sm text-on-surface-variant font-normal">kg</span>
              </span>
            </div>
          </div>

          <!-- Card 2: Valor Estimado -->
          <div class="bg-surface-container-lowest p-3 rounded-2xl flex flex-col justify-between shadow-sm">
            <div
              class="w-7 h-7 rounded-lg bg-surface-container text-primary-container flex items-center justify-center mb-2"
            >
              <span class="material-symbols-outlined text-[18px]">payments</span>
            </div>
            <div class="flex flex-col">
              <span class="font-label-sm text-label-sm text-on-surface-variant">Valor Estim.</span>
              <span
                class="font-headline-sm text-headline-sm text-on-surface tracking-tight mt-0.5 leading-none"
              >
                R$ {{ store.totalEstimatedValue }}
              </span>
            </div>
          </div>

          <!-- Card 3: Lista de Pedido Ativa -->
          <div
            @click="currentScreen = 'exportar'"
            class="cursor-pointer bg-surface-container-lowest p-3 rounded-2xl flex flex-col justify-between shadow-sm hover:ring-2 hover:ring-primary/30 transition"
          >
            <div
              class="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2"
            >
              <span class="material-symbols-outlined text-[18px]">share</span>
            </div>
            <div class="flex flex-col">
              <span class="font-label-sm text-label-sm text-on-surface-variant">Lista Pedido</span>
              <div class="flex items-center gap-1 mt-0.5">
                <span class="font-headline-sm text-headline-sm text-primary">
                  {{ store.selectedOrderItems.length }} itens
                </span>
              </div>
              <span class="font-label-sm text-label-sm text-primary font-semibold">
                Enviar WhatsApp →
              </span>
            </div>
          </div>
        </section>

        <!-- Stock Product Listing Header -->
        <div class="flex items-center justify-between pt-1">
          <div class="flex items-center gap-1.5">
            <h2 class="font-headline-sm text-headline-sm text-on-surface">Produtos em Giro</h2>
            <span
              class="bg-surface-container-high text-on-surface px-2 py-0.5 rounded-full font-label-sm text-label-sm"
            >
              {{ filteredProducts.length }} exibidos
            </span>
          </div>
          <button
            @click="sortAsc = !sortAsc"
            class="text-primary font-label-md text-label-md flex items-center gap-0.5 hover:underline"
            type="button"
          >
            <span>Ordenar</span>
            <span class="material-symbols-outlined text-[16px]">swap_vert</span>
          </button>
        </div>

        <!-- Produce Cards List (Idêntico ao Stitch + Seleção p/ Lista de Pedido e Calculadora) -->
        <section class="flex flex-col space-y-space-sm">
          <article
            v-for="item in filteredProducts"
            :key="item.id"
            class="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col space-y-3 transition-all"
            :class="{
              'bg-gradient-to-r from-tertiary-fixed/15 via-surface-container-lowest to-surface-container-lowest':
                item.status === 'warning',
              'bg-gradient-to-r from-error-container/30 via-surface-container-lowest to-surface-container-lowest':
                item.status === 'critical',
            }"
          >
            <div class="flex items-start justify-between gap-space-sm">
              <div class="flex items-center gap-space-sm min-w-0">
                <div
                  class="w-12 h-12 rounded-xl bg-surface-container-high overflow-hidden flex-shrink-0 relative flex items-center justify-center"
                >
                  <img class="w-full h-full object-cover" :alt="item.name" :src="item.image" />
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <h3 class="font-headline-sm text-headline-sm text-on-surface truncate">
                      {{ item.name }}
                    </h3>
                    <!-- Status Badge -->
                    <span
                      v-if="item.status === 'ok'"
                      class="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm flex items-center gap-0.5"
                    >
                      <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
                      {{ item.statusBadge }}
                    </span>
                    <span
                      v-else-if="item.status === 'warning'"
                      class="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant font-label-sm text-label-sm flex items-center gap-0.5"
                    >
                      <span class="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                      {{ item.statusBadge }}
                    </span>
                    <span
                      v-else
                      class="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm flex items-center gap-0.5 font-bold animate-pulse"
                    >
                      <span class="w-1.5 h-1.5 rounded-full bg-error"></span>
                      {{ item.statusBadge }}
                    </span>
                  </div>
                  <p
                    class="font-body-sm text-body-sm"
                    :class="
                      item.status === 'critical'
                        ? 'text-error font-semibold'
                        : item.status === 'warning'
                          ? 'text-tertiary font-semibold'
                          : 'text-on-surface-variant'
                    "
                  >
                    {{ item.subtitle }}
                  </p>
                </div>
              </div>

              <!-- Botão Seleção Rápida p/ Lista de Pedido + Menu 3 Pontos -->
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  @click="store.toggleOrderSelect(item)"
                  :class="[
                    'px-2.5 py-1 rounded-full font-label-sm text-label-sm flex items-center gap-1 transition-all active:scale-95',
                    store.orderSelection[item.id]?.selected
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface',
                  ]"
                  title="Selecionar para a Lista de Pedido (WhatsApp)"
                >
                  <span class="material-symbols-outlined text-[14px]">
                    {{
                      store.orderSelection[item.id]?.selected
                        ? 'check_box'
                        : 'check_box_outline_blank'
                    }}
                  </span>
                  <span>{{ store.orderSelection[item.id]?.selected ? 'Na Lista' : 'Pedir' }}</span>
                </button>

                <button
                  :aria-label="'Opções para ' + item.name"
                  class="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container active:scale-95 transition-colors"
                  @click="toggleItemMenu(item.id)"
                  type="button"
                >
                  <span class="material-symbols-outlined text-[20px]">more_vert</span>
                </button>
              </div>
            </div>

            <!-- Detail & Stepper Row -->
            <div class="flex items-center justify-between pt-1">
              <div class="flex flex-col">
                <span class="font-headline-sm text-headline-sm text-on-surface">
                  <span>{{ item.qty }}</span>
                  <span class="font-body-sm text-body-sm text-on-surface-variant font-normal ml-1">
                    {{ item.unitLabel }}
                  </span>
                </span>
                <span class="font-label-sm text-label-sm text-on-surface-variant">
                  R$ {{ Number(item.salePrice).toFixed(2).replace('.', ',') }} / {{ item.unit }}
                </span>
              </div>

              <!-- Quick Quantity Stepper + Botão Calculadora Opcional -->
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  @click="openScaleCalculator('estoque', item)"
                  class="w-9 h-9 rounded-xl bg-surface-container text-primary flex items-center justify-center hover:bg-surface-container-highest active:scale-90 transition"
                  title="Usar Calculadora de Balança / Tara neste item"
                >
                  <span class="material-symbols-outlined text-[18px]">calculate</span>
                </button>

                <div class="flex items-center gap-2 bg-surface-container-low px-2 py-1.5 rounded-xl">
                  <button
                    class="w-8 h-8 rounded-lg bg-surface-container-lowest text-on-surface flex items-center justify-center shadow-sm active:scale-90 transition-transform"
                    @click="store.updateStock(item.id, -1)"
                    type="button"
                  >
                    <span class="material-symbols-outlined text-[18px]">remove</span>
                  </button>
                  <span class="font-label-md text-label-md text-on-surface px-1">Ajustar</span>
                  <button
                    class="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shadow-sm active:scale-90 transition-transform"
                    @click="store.updateStock(item.id, 1)"
                    type="button"
                  >
                    <span class="material-symbols-outlined text-[18px]">add</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Action Drawer Dropdown (When 3 dots clicked) -->
            <div
              v-if="openMenuProductId === item.id"
              class="flex items-center gap-2 pt-2 border-t border-surface-container"
            >
              <button
                class="flex-1 py-2 px-3 rounded-lg bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md flex items-center justify-center gap-1 active:scale-95 transition-transform"
                @click="openRegisterLossForProduct(item)"
                type="button"
              >
                <span class="material-symbols-outlined text-[16px]">report_problem</span>
                Registrar Perda
              </button>
              <button
                class="flex-1 py-2 px-3 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md flex items-center justify-center gap-1 active:scale-95 transition-transform"
                @click="openScaleCalculator('estoque', item)"
                type="button"
              >
                <span class="material-symbols-outlined text-[16px]">scale</span>
                Pesar c/ Tara
              </button>
            </div>
          </article>
        </section>

        <!-- Sticky Quick Cadastrar Action Floating Button -->
        <div class="sticky bottom-20 self-end z-40 pointer-events-auto">
          <button
            @click="currentScreen = 'cadastrar'"
            class="h-14 px-5 rounded-full bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center gap-2.5 shadow-xl shadow-primary/25 active:scale-95 transition-all transform hover:-translate-y-0.5"
            type="button"
          >
            <span class="material-symbols-outlined text-[24px]">add_box</span>
            <span>Novo Produto</span>
          </button>
        </div>
      </div>

      <!-- ====================================================================
           TELA 2: CADASTRAR PRODUTO (cadastrar_produto/code.html)
           ==================================================================== -->
      <div
        v-else-if="currentScreen === 'cadastrar'"
        class="px-margin-mobile pt-space-sm pb-space-xl flex flex-col gap-space-lg max-w-lg mx-auto w-full"
      >
        <!-- Hero / Header contextual amigável -->
        <div class="flex flex-col gap-1">
          <div class="inline-flex items-center gap-1.5 text-primary">
            <span class="material-symbols-outlined text-[18px]">eco</span>
            <span class="font-label-sm text-label-sm uppercase tracking-wider">Hortifrúti Fresco</span>
          </div>
          <h1 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight">
            Novo Produto
          </h1>
          <p class="font-body-md text-body-md text-on-surface-variant">
            Adicione frutas, verduras ou legumes ao estoque com calculadora opcional e rastreio de validade.
          </p>
        </div>

        <!-- Category Selector (Visual Cards) -->
        <div class="flex flex-col gap-space-xs">
          <div class="flex items-center justify-between">
            <label class="font-label-lg text-label-lg text-on-surface">Categoria</label>
            <span class="font-label-sm text-label-sm text-primary font-bold">1 selecionada</span>
          </div>
          <div class="grid grid-cols-3 gap-2.5">
            <button
              v-for="cat in [
                { key: 'frutas', title: 'Frutas', sub: 'Frescor & Doces', icon: 'nutrition' },
                { key: 'verduras', title: 'Verduras', sub: 'Folhas & Ramos', icon: 'spa' },
                { key: 'legumes', title: 'Legumes', sub: 'Raízes & Vagens', icon: 'psychiatry' },
              ]"
              :key="cat.key"
              @click="newProdCategory = cat.key"
              :class="[
                'flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 shadow-sm active:scale-95 text-center relative overflow-hidden group',
                newProdCategory === cat.key
                  ? 'bg-primary-fixed text-on-primary-fixed font-bold'
                  : 'bg-surface-container text-on-surface',
              ]"
              type="button"
            >
              <div
                class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110"
              >
                <span class="material-symbols-outlined text-[24px]">{{ cat.icon }}</span>
              </div>
              <span class="font-label-md text-label-md font-bold leading-tight">{{ cat.title }}</span>
              <span class="font-label-sm text-label-sm opacity-70">{{ cat.sub }}</span>
              <div
                v-if="newProdCategory === cat.key"
                class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary"
              ></div>
            </button>
          </div>
        </div>

        <!-- Nome do Produto com Autocomplete Chips -->
        <div class="flex flex-col gap-space-xs">
          <label class="font-label-lg text-label-lg text-on-surface flex items-center justify-between">
            <span>Nome do Item</span>
            <span class="font-label-sm text-label-sm text-on-surface-variant font-normal">
              Obrigatório
            </span>
          </label>
          <div class="relative flex items-center">
            <input
              v-model="newProdName"
              class="w-full bg-surface-container-lowest text-on-surface rounded-xl px-4 py-3.5 pr-11 font-body-lg text-body-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/50 transition-all"
              placeholder="Ex: Tomate Carmem Especial"
              type="text"
            />
            <button
              v-if="newProdName"
              @click="newProdName = ''"
              class="absolute right-3 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant/60 hover:text-on-surface transition-colors"
              type="button"
            >
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <!-- Sugestões Rápidas Interativas -->
          <div class="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5">
            <span class="font-label-sm text-label-sm text-on-surface-variant shrink-0">
              Sugestões:
            </span>
            <button
              v-for="chip in quickSuggestions"
              :key="chip.label"
              @click="selectSuggestionChip(chip)"
              class="shrink-0 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant hover:bg-primary/15 hover:text-primary transition-colors font-label-md text-label-md"
              type="button"
            >
              {{ chip.label }}
            </button>
          </div>
        </div>

        <!-- Unidade de Medida (Segmented Control) -->
        <div class="flex flex-col gap-space-xs">
          <label class="font-label-lg text-label-lg text-on-surface">Unidade de Medida</label>
          <div class="grid grid-cols-3 p-1 rounded-xl bg-surface-container">
            <button
              v-for="u in [
                { key: 'kg', label: 'Quilo (kg)' },
                { key: 'un', label: 'Unidade (un)' },
                { key: 'cx', label: 'Maço / Caixa' },
              ]"
              :key="u.key"
              @click="newProdUnit = u.key"
              :class="[
                'py-2.5 rounded-lg font-label-md text-label-md text-center transition-all duration-150',
                newProdUnit === u.key
                  ? 'font-bold bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface',
              ]"
              type="button"
            >
              {{ u.label }}
            </button>
          </div>
        </div>

        <!-- Quantidade Inicial (Stepper Tátil Grande + Botão Calculadora de Balança Opcional) -->
        <div class="p-4 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              <span class="font-label-lg text-label-lg text-on-surface">Estoque de Entrada</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">
                {{ newProdCalcNote || 'Lote inicial ou quantidade para pedido' }}
              </span>
            </div>
            <button
              type="button"
              @click="openScaleCalculator('cadastrar', null)"
              class="px-3 py-1.5 rounded-lg bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm flex items-center gap-1 shadow-xs active:scale-95 transition"
            >
              <span class="material-symbols-outlined text-[16px]">calculate</span>
              <span>Usar Calculadora</span>
            </button>
          </div>

          <div class="flex items-center justify-between bg-surface-container-low rounded-xl p-2">
            <button
              aria-label="Diminuir quantidade"
              @click="adjustNewProdQty(-1)"
              class="w-12 h-12 rounded-xl bg-surface-container-lowest text-on-surface flex items-center justify-center shadow-sm active:scale-90 active:bg-surface-container-high transition-all"
              type="button"
            >
              <span class="material-symbols-outlined text-[24px]">remove</span>
            </button>
            <div class="flex flex-col items-center">
              <input
                v-model.number="newProdQty"
                class="w-24 text-center bg-transparent font-headline-xl-mobile text-headline-xl-mobile text-primary font-extrabold focus:outline-none tracking-tight"
                max="9999"
                min="1"
                type="number"
              />
              <span class="font-label-sm text-label-sm text-on-surface-variant">
                {{ Number(newProdQty || 0).toFixed(1) }} {{ newProdUnit }} confirmados
              </span>
            </div>
            <button
              aria-label="Aumentar quantidade"
              @click="adjustNewProdQty(1)"
              class="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm active:scale-90 active:bg-primary-container transition-all"
              type="button"
            >
              <span class="material-symbols-outlined text-[24px]">add</span>
            </button>
          </div>

          <!-- Quick Step Badges -->
          <div class="flex items-center justify-center gap-2 pt-1">
            <button
              v-for="step in [5, 10, 25, 50]"
              :key="step"
              @click="adjustNewProdQty(step)"
              class="px-3 py-1 rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
              type="button"
            >
              +{{ step }}
            </button>
          </div>
        </div>

        <!-- Preços & Margem de Lucro Automática (Card Financeiro) -->
        <div class="p-4 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="font-label-lg text-label-lg text-on-surface">
              Precificação Unitária (Opcional)
            </span>
            <span class="material-symbols-outlined text-[18px] text-primary">monitoring</span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label class="font-label-sm text-label-sm text-on-surface-variant">
                Preço de Custo (R$)
              </label>
              <div class="relative">
                <span
                  class="absolute left-3 top-1/2 -translate-y-1/2 font-label-md text-label-md text-on-surface-variant"
                >
                  R$
                </span>
                <input
                  v-model.number="newProdCost"
                  class="w-full bg-surface-container-low text-on-surface rounded-lg pl-9 pr-3 py-2.5 font-label-lg text-label-lg focus:outline-none focus:bg-surface-container-high transition-colors"
                  step="0.10"
                  type="number"
                />
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-label-sm text-label-sm text-on-surface-variant">
                Preço de Venda (R$)
              </label>
              <div class="relative">
                <span
                  class="absolute left-3 top-1/2 -translate-y-1/2 font-label-md text-label-md text-on-surface-variant"
                >
                  R$
                </span>
                <input
                  v-model.number="newProdSale"
                  class="w-full bg-surface-container-low text-on-surface rounded-lg pl-9 pr-3 py-2.5 font-label-lg text-label-lg focus:outline-none focus:bg-surface-container-high transition-colors"
                  step="0.10"
                  type="number"
                />
              </div>
            </div>
          </div>
          <!-- Live Profit Margin Calculator -->
          <div class="p-3 rounded-lg bg-surface-container flex items-center justify-between transition-colors">
            <div class="flex items-center gap-2">
              <div
                class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center"
              >
                <span class="material-symbols-outlined text-[18px]">trending_up</span>
              </div>
              <div class="flex flex-col">
                <span class="font-label-sm text-label-sm text-on-surface-variant">
                  Margem Bruta Projetada
                </span>
                <span class="font-body-sm text-body-sm text-on-surface font-semibold">
                  Lucro de R$ {{ newProdProfitSpread }} por {{ newProdUnit }}
                </span>
              </div>
            </div>
            <div class="text-right">
              <span
                class="font-headline-sm text-headline-sm font-extrabold"
                :class="newProdMarginPct < 0 ? 'text-error' : 'text-primary'"
              >
                {{ newProdMarginPct >= 0 ? `+${newProdMarginPct}%` : `${newProdMarginPct}%` }}
              </span>
            </div>
          </div>
        </div>

        <!-- Datas: Recebimento e Validade com Cálculo de Dias -->
        <div class="p-4 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-tertiary-container text-[20px]">
                calendar_today
              </span>
              <span class="font-label-lg text-label-lg text-on-surface">Ciclo de Validade</span>
            </div>
            <span
              class="px-2 py-0.5 rounded-full font-label-sm text-label-sm"
              :class="
                newProdShelfLifeDays > 0
                  ? 'bg-surface-container-high text-on-surface'
                  : 'bg-error-container text-error'
              "
            >
              {{
                newProdShelfLifeDays > 0
                  ? `${newProdShelfLifeDays} dias de vida útil`
                  : 'Atenção: Vencimento imediato'
              }}
            </span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label class="font-label-sm text-label-sm text-on-surface-variant">
                Recebimento/Colheita
              </label>
              <input
                v-model="newProdHarvestDate"
                class="w-full bg-surface-container-low text-on-surface rounded-lg px-3 py-2 font-label-md text-label-md focus:outline-none"
                type="date"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-label-sm text-label-sm text-on-surface-variant">
                Validade Estimada
              </label>
              <input
                v-model="newProdExpiryDate"
                class="w-full bg-surface-container-low text-on-surface rounded-lg px-3 py-2 font-label-md text-label-md focus:outline-none"
                type="date"
              />
            </div>
          </div>
          <!-- Segmented Freshness Bar Simulator -->
          <div class="flex flex-col gap-1.5 pt-1">
            <div
              class="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant"
            >
              <span>Curva de Frescor Estimada</span>
              <span class="text-primary font-bold">Ótima durabilidade</span>
            </div>
            <div class="w-full h-2 rounded-full bg-surface-container flex overflow-hidden">
              <div class="h-full bg-primary rounded-l-full" style="width: 70%"></div>
              <div class="h-full bg-tertiary-fixed-dim" style="width: 20%"></div>
              <div class="h-full bg-secondary-fixed-dim rounded-r-full" style="width: 10%"></div>
            </div>
          </div>
        </div>

        <!-- Toggle Incluir automaticamente na Lista de Pedido WhatsApp -->
        <div
          class="p-4 rounded-xl bg-surface-container-lowest shadow-sm flex items-start justify-between gap-3"
        >
          <div class="flex items-start gap-3">
            <div
              class="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed shrink-0 mt-0.5"
            >
              <span class="material-symbols-outlined text-[20px]">shopping_cart_checkout</span>
            </div>
            <div class="flex flex-col">
              <span class="font-label-lg text-label-lg text-on-surface font-bold">
                Incluir na Lista de Pedido (WhatsApp)
              </span>
              <p class="font-body-sm text-body-sm text-on-surface-variant leading-snug pt-0.5">
                Já deixa este item <span class="font-bold text-on-surface">selecionado</span> na aba Exportar para copiar ou enviar no WhatsApp.
              </p>
            </div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
            <input v-model="newProdIncludeOrder" class="sr-only peer" type="checkbox" />
            <div
              class="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"
            ></div>
          </label>
        </div>

        <!-- Preview Card do Lote -->
        <div class="p-3.5 rounded-xl bg-surface-container/60 flex items-center gap-3">
          <div
            class="w-12 h-12 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm"
          >
            <span class="material-symbols-outlined text-[28px]">
              {{
                newProdCategory === 'frutas'
                  ? 'nutrition'
                  : newProdCategory === 'verduras'
                    ? 'spa'
                    : 'psychiatry'
              }}
            </span>
          </div>
          <div class="flex flex-col min-w-0 flex-1">
            <span class="font-label-md text-label-md text-on-surface truncate">
              {{ newProdName.trim() || 'Tomate Carmem Especial' }}
            </span>
            <span class="font-body-sm text-body-sm text-on-surface-variant truncate">
              {{ newProdPreviewSummary }}
            </span>
          </div>
          <div class="w-2 h-2 rounded-full bg-primary animate-ping"></div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col gap-2.5 pt-2">
          <button
            @click="handleSaveProduct(false)"
            class="w-full h-14 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 shadow-md hover:bg-primary-container active:scale-[0.99] transition-all"
            type="button"
          >
            <span class="material-symbols-outlined text-[22px]">check_circle</span>
            <span>Salvar no Estoque</span>
          </button>
          <button
            @click="handleSaveProduct(true)"
            class="w-full h-12 rounded-xl bg-surface-container-high text-primary font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 hover:bg-surface-container-highest active:scale-[0.99] transition-all"
            type="button"
          >
            <span class="material-symbols-outlined text-[20px]">add_circle</span>
            <span>Salvar e Cadastrar Outro</span>
          </button>
        </div>
      </div>

      <!-- ====================================================================
           TELA 3: CONTROLE DE PERDAS & DESPERDÍCIO (controle_de_perdas_desperd_cio)
           ==================================================================== -->
      <div v-else-if="currentScreen === 'perdas'" class="flex flex-col w-full pb-10">
        <!-- Top Ambient Banner & KPIs -->
        <div class="px-margin-mobile pt-space-sm space-y-space-md">
          <!-- Hero / Action Banner -->
          <div class="relative overflow-hidden rounded-xl bg-surface-container p-space-md shadow-sm">
            <div
              class="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-secondary-container/10 blur-xl pointer-events-none"
            ></div>
            <div class="flex items-center justify-between mb-space-sm">
              <div class="flex items-center gap-space-xs">
                <span class="flex h-2 w-2 rounded-full bg-secondary-container animate-pulse"></span>
                <span class="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                  Auditoria Ativa • Fonseca
                </span>
              </div>
              <span
                class="font-label-md text-label-md text-on-surface-variant bg-surface-container-lowest px-2 py-0.5 rounded-full shadow-sm"
              >
                Meta: &lt; 2.5%
              </span>
            </div>
            <div class="flex flex-col gap-space-xs">
              <h2 class="font-headline-md text-headline-md text-on-surface tracking-tight">
                Controle de Desperdício
              </h2>
              <p class="font-body-sm text-body-sm text-on-surface-variant">
                Ações rápidas de reclassificação salvam margem e evitam descarte.
              </p>
            </div>
            <!-- Action Button: Registrar Nova Perda (Abre a Tela 5 do Stitch!) -->
            <button
              @click="currentScreen = 'registrar_baixa'"
              class="mt-space-md w-full h-12 bg-secondary-container hover:bg-secondary text-on-error font-label-lg text-label-lg rounded-lg shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-space-xs"
            >
              <span class="material-symbols-outlined text-[20px]">add_circle</span>
              <span>+ Registrar Nova Baixa / Perda</span>
            </button>
          </div>

          <!-- KPI Cards Grid -->
          <div class="grid grid-cols-2 gap-gutter-mobile">
            <div
              class="col-span-1 bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between"
            >
              <div class="flex items-center justify-between">
                <span
                  class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide"
                >
                  Perdas no Mês
                </span>
                <div
                  class="w-7 h-7 rounded-full bg-error-container flex items-center justify-center text-error"
                >
                  <span class="material-symbols-outlined text-[16px]">trending_down</span>
                </div>
              </div>
              <div class="mt-space-xs">
                <div
                  class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-extrabold tracking-tight"
                >
                  R$ {{ Math.floor(store.totalLossMonthBrl) }}<span class="text-sm font-semibold text-on-surface-variant">,00</span>
                </div>
                <div
                  class="mt-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm"
                >
                  <span class="material-symbols-outlined text-[12px]">arrow_downward</span>
                  <span>-18% vs mês ant.</span>
                </div>
              </div>
            </div>

            <div
              class="col-span-1 bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between"
            >
              <div class="flex items-center justify-between">
                <span
                  class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide"
                >
                  Volume Total
                </span>
                <div
                  class="w-7 h-7 rounded-full bg-secondary-fixed flex items-center justify-center text-secondary"
                >
                  <span class="material-symbols-outlined text-[16px]">scale</span>
                </div>
              </div>
              <div class="mt-space-xs">
                <div
                  class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-extrabold tracking-tight"
                >
                  {{ store.totalLossMonthKg }}
                  <span class="text-sm font-semibold text-on-surface-variant">kg</span>
                </div>
                <div
                  class="mt-1 text-on-surface-variant font-body-sm text-body-sm flex items-center gap-1"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  <span>2.1% do recebimento</span>
                </div>
              </div>
            </div>

            <div
              class="col-span-2 bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex items-center justify-between"
            >
              <div class="flex items-center gap-space-sm min-w-0">
                <div
                  class="w-10 h-10 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary shrink-0"
                >
                  <span class="material-symbols-outlined text-[22px]">timer</span>
                </div>
                <div class="min-w-0">
                  <div class="font-label-sm text-label-sm text-on-surface-variant uppercase">
                    Principal Gargalo
                  </div>
                  <div class="font-headline-sm text-headline-sm text-on-surface truncate">
                    Maturação Excessiva
                  </div>
                  <div class="font-body-sm text-body-sm text-on-surface-variant">
                    54% das ocorrências registradas
                  </div>
                </div>
              </div>
              <div
                class="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-surface-container text-tertiary font-headline-sm text-headline-sm"
              >
                54%
              </div>
            </div>
          </div>
        </div>

        <!-- Immediate Warning / Urgent Action Section -->
        <div class="mt-space-lg px-margin-mobile">
          <div class="flex items-center justify-between mb-space-sm">
            <div class="flex items-center gap-space-xs">
              <span class="material-symbols-outlined text-secondary text-[20px]">warning</span>
              <h3 class="font-headline-sm text-headline-sm text-on-surface">Atenção Imediata</h3>
            </div>
            <span
              class="font-label-sm text-label-sm bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded-full"
            >
              2 lotes críticos
            </span>
          </div>

          <div class="space-y-space-sm">
            <!-- Critical Card 1: Alface -->
            <div
              class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm relative overflow-hidden"
            >
              <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-error"></div>
              <div class="flex gap-space-sm">
                <img
                  class="w-14 h-14 rounded-lg object-cover shrink-0"
                  alt="Alface"
                  :src="store.products[1]?.image"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-1">
                    <h4 class="font-headline-sm text-headline-sm text-on-surface truncate">
                      Alface Crespa
                    </h4>
                    <span
                      class="font-label-sm text-label-sm uppercase bg-error-container text-on-error-container px-2 py-0.5 rounded-full whitespace-nowrap"
                    >
                      Vence Hoje
                    </span>
                  </div>
                  <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Lote #9942 • 12 maços em câmara fria
                  </p>
                  <div
                    class="mt-space-sm p-2 rounded-lg bg-surface-container-low flex items-center justify-between gap-2"
                  >
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span class="material-symbols-outlined text-primary text-[18px] shrink-0">
                        price_check
                      </span>
                      <span class="font-label-sm text-label-sm text-on-surface truncate">
                        Sugerido: -30% ou Doação
                      </span>
                    </div>
                    <button
                      @click="store.showToast('Oferta -30% aplicada em Alface Crespa!')"
                      class="bg-primary text-on-primary font-label-sm text-label-sm px-2.5 py-1 rounded-md shrink-0 active:scale-95 transition-transform"
                    >
                      Aplicar Oferta
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Critical Card 2: Mamão Formosa -->
            <div
              class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm relative overflow-hidden"
            >
              <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-secondary-container"></div>
              <div class="flex gap-space-sm">
                <img
                  class="w-14 h-14 rounded-lg object-cover shrink-0"
                  alt="Mamão Formosa"
                  :src="store.products[5]?.image"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-1">
                    <h4 class="font-headline-sm text-headline-sm text-on-surface truncate">
                      Mamão Formosa
                    </h4>
                    <span
                      class="font-label-sm text-label-sm uppercase bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded-full whitespace-nowrap"
                    >
                      Maturação Rápida
                    </span>
                  </div>
                  <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Lote #8819 • 8.0 kg na bancada principal
                  </p>
                  <div
                    class="mt-space-sm p-2 rounded-lg bg-surface-container-low flex items-center justify-between gap-2"
                  >
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span class="material-symbols-outlined text-tertiary text-[18px] shrink-0">
                        restaurant
                      </span>
                      <span class="font-label-sm text-label-sm text-on-surface truncate">
                        Sugerido: Fracionar p/ Bandeja
                      </span>
                    </div>
                    <button
                      @click="store.showToast('Ordem de corte/bandeja enviada para Mamão Formosa!')"
                      class="bg-surface-container-highest text-on-surface font-label-sm text-label-sm px-2.5 py-1 rounded-md shrink-0 active:scale-95 transition-transform"
                    >
                      Cortar &amp; Reembalar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Loss Reasons Visual Breakdown -->
        <div class="mt-space-lg px-margin-mobile">
          <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
            <div class="flex items-center justify-between mb-space-sm">
              <div>
                <h3 class="font-headline-sm text-headline-sm text-on-surface">
                  Motivos de Descarte
                </h3>
                <p class="font-body-sm text-body-sm text-on-surface-variant">
                  Distribuição percentual deste mês
                </p>
              </div>
              <div
                class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant"
              >
                <span class="material-symbols-outlined text-[18px]">pie_chart</span>
              </div>
            </div>
            <div
              class="w-full h-3 rounded-full bg-surface-container overflow-hidden flex gap-0.5 my-space-sm"
            >
              <div class="h-full bg-secondary-container rounded-l-full" style="width: 52%"></div>
              <div class="h-full bg-tertiary" style="width: 28%"></div>
              <div class="h-full bg-outline" style="width: 14%"></div>
              <div class="h-full bg-outline-variant rounded-r-full" style="width: 6%"></div>
            </div>
            <div class="space-y-space-xs mt-space-sm pt-space-xs">
              <div class="flex items-center justify-between py-1">
                <div class="flex items-center gap-space-xs">
                  <span class="w-2.5 h-2.5 rounded-full bg-secondary-container"></span>
                  <span class="font-body-md text-body-md text-on-surface">
                    Vencimento / Estragou
                  </span>
                </div>
                <span class="font-label-lg text-label-lg text-on-surface font-bold">52%</span>
              </div>
              <div class="flex items-center justify-between py-1">
                <div class="flex items-center gap-space-xs">
                  <span class="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
                  <span class="font-body-md text-body-md text-on-surface">
                    Dano mecânico / Transporte
                  </span>
                </div>
                <span class="font-label-lg text-label-lg text-on-surface font-bold">28%</span>
              </div>
              <div class="flex items-center justify-between py-1">
                <div class="flex items-center gap-space-xs">
                  <span class="w-2.5 h-2.5 rounded-full bg-outline"></span>
                  <span class="font-body-md text-body-md text-on-surface">
                    Qualidade no recebimento
                  </span>
                </div>
                <span class="font-label-lg text-label-lg text-on-surface font-bold">14%</span>
              </div>
              <div class="flex items-center justify-between py-1">
                <div class="flex items-center gap-space-xs">
                  <span class="w-2.5 h-2.5 rounded-full bg-outline-variant"></span>
                  <span class="font-body-md text-body-md text-on-surface">
                    Outros (avariado/quebra)
                  </span>
                </div>
                <span class="font-label-lg text-label-lg text-on-surface font-bold">6%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Write-off History -->
        <div class="mt-space-lg px-margin-mobile">
          <div class="flex items-center justify-between mb-space-sm">
            <div class="flex items-center gap-space-xs">
              <span class="material-symbols-outlined text-on-surface-variant text-[20px]">
                history
              </span>
              <h3 class="font-headline-sm text-headline-sm text-on-surface">Histórico Recente</h3>
            </div>
          </div>
          <div class="space-y-space-sm">
            <div
              v-for="l in store.losses"
              :key="l.id"
              class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex items-center justify-between gap-space-sm"
            >
              <div class="flex items-center gap-space-sm min-w-0">
                <div
                  class="w-10 h-10 rounded-lg bg-surface-container flex flex-col items-center justify-center shrink-0 text-center"
                >
                  <span
                    class="font-label-sm text-label-sm uppercase text-on-surface-variant leading-none"
                  >
                    {{ l.monthShort }}
                  </span>
                  <span class="font-headline-sm text-headline-sm font-bold text-on-surface leading-tight">
                    {{ l.day }}
                  </span>
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <h4 class="font-body-lg text-body-lg font-semibold text-on-surface truncate">
                      {{ l.productName }}
                    </h4>
                    <span
                      class="font-label-sm text-label-sm text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded"
                    >
                      {{ l.qtyLabel }}
                    </span>
                  </div>
                  <p
                    class="font-body-sm text-body-sm truncate mt-0.5 flex items-center gap-1"
                    :class="l.reasonColor"
                  >
                    <span class="material-symbols-outlined text-[14px]">{{ l.reasonIcon }}</span>
                    {{ l.reasonTitle }}
                  </p>
                </div>
              </div>
              <div class="text-right shrink-0">
                <div class="font-label-lg text-label-lg font-bold text-error">
                  - R$ {{ Number(l.costValue).toFixed(2).replace('.', ',') }}
                </div>
                <span class="font-label-sm text-label-sm text-on-surface-variant">
                  {{ l.codeLabel }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ====================================================================
           TELA 5: REGISTRAR BAIXA DE PERDA (registrar_baixa_de_perda/code.html)
           ==================================================================== -->
      <div v-else-if="currentScreen === 'registrar_baixa'" class="flex flex-col w-full pb-10">
        <!-- Top Banner -->
        <div class="px-margin-mobile pt-space-sm mb-space-md">
          <div
            class="bg-surface-container-low rounded-xl p-space-md flex items-center justify-between shadow-sm"
          >
            <div class="flex items-center gap-space-sm">
              <div
                class="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary shrink-0"
              >
                <span class="material-symbols-outlined text-[22px]">inventory_2</span>
              </div>
              <div>
                <span
                  class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block"
                >
                  Setor Hortifrúti • Auditório
                </span>
                <span class="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Baixa Imediata
                </span>
              </div>
            </div>
            <span
              class="inline-flex items-center gap-1 font-label-md text-label-md px-2.5 py-1 rounded-full bg-error-container text-on-error-container font-semibold"
            >
              <span class="material-symbols-outlined text-[16px]">warning</span>
              Estoque Ativo
            </span>
          </div>
        </div>

        <form
          class="flex flex-col gap-space-lg px-margin-mobile"
          @submit.prevent="showConfirmLossModal = true"
        >
          <!-- 1. Seleção de Produto -->
          <div
            class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm"
          >
            <div class="flex items-center justify-between">
              <label class="font-label-lg text-label-lg text-on-surface flex items-center gap-1.5">
                <span class="material-symbols-outlined text-primary text-[20px]">grocery</span>
                Item Selecionado
              </label>
              <span
                class="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-bold"
              >
                {{ currentLossProduct?.lotCode || 'Lote #3842' }}
              </span>
            </div>

            <div class="flex items-center gap-space-sm p-3 bg-surface-container-low rounded-lg">
              <div
                class="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0 overflow-hidden"
              >
                <img
                  class="w-full h-full object-cover"
                  :alt="currentLossProduct?.name"
                  :src="currentLossProduct?.image"
                />
              </div>
              <div class="flex-1 min-w-0">
                <select
                  v-model="lossTargetProductId"
                  class="w-full bg-transparent font-headline-sm text-headline-sm text-on-surface font-bold focus:outline-none"
                >
                  <option v-for="p in store.products" :key="p.id" :value="p.id">
                    {{ p.name }} (Disp: {{ p.qty }} {{ p.unitLabel }})
                  </option>
                </select>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="font-body-sm text-body-sm text-on-surface-variant">
                    Estoque disponível:
                  </span>
                  <span class="font-label-md text-label-md text-primary font-bold">
                    {{ currentLossProduct?.qty }} {{ currentLossProduct?.unitLabel }}
                  </span>
                  <span class="font-body-sm text-body-sm text-outline">
                    • R$ {{ Number(currentLossProduct?.salePrice || 6.5).toFixed(2).replace('.', ',') }}/{{ currentLossProduct?.unit }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Quantidade Perdida & Seletor Rápido + Calculadora de Tara -->
          <div
            class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm"
          >
            <div class="flex items-center justify-between">
              <label class="font-label-lg text-label-lg text-on-surface flex items-center gap-1.5">
                <span class="material-symbols-outlined text-secondary text-[20px]">scale</span>
                Peso / Quantidade da Baixa
              </label>
              <button
                type="button"
                @click="openScaleCalculator('baixa', currentLossProduct)"
                class="px-2.5 py-1 rounded-lg bg-surface-container text-primary font-label-sm text-label-sm flex items-center gap-1"
              >
                <span class="material-symbols-outlined text-[15px]">calculate</span>
                Descontar Cesto/Tara
              </button>
            </div>

            <div class="flex items-center justify-between bg-surface-container-low rounded-xl p-2">
              <button
                class="w-12 h-12 rounded-lg bg-surface-container-lowest text-on-surface font-bold flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                @click="adjustLossQty(-0.5)"
                type="button"
              >
                <span class="material-symbols-outlined text-[24px]">remove</span>
              </button>
              <div class="flex flex-col items-center justify-center">
                <div class="flex items-baseline gap-1">
                  <input
                    v-model.number="lossQuantity"
                    class="font-headline-xl-mobile text-headline-xl-mobile text-on-surface font-extrabold w-28 text-center bg-transparent focus:outline-none"
                    min="0.1"
                    step="0.1"
                    type="number"
                  />
                  <span class="font-headline-sm text-headline-sm text-on-surface-variant font-bold">
                    {{ currentLossProduct?.unit || 'kg' }}
                  </span>
                </div>
                <span class="font-label-sm text-label-sm text-outline">Toque para digitar</span>
              </div>
              <button
                class="w-12 h-12 rounded-lg bg-surface-container-lowest text-on-surface font-bold flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                @click="adjustLossQty(0.5)"
                type="button"
              >
                <span class="material-symbols-outlined text-[24px]">add</span>
              </button>
            </div>

            <div class="flex items-center gap-2 pt-1">
              <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">
                Incremento:
              </span>
              <button
                class="flex-1 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md font-bold text-center"
                @click="adjustLossQty(1)"
                type="button"
              >
                +1 kg
              </button>
              <button
                class="flex-1 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md font-bold text-center"
                @click="adjustLossQty(5)"
                type="button"
              >
                +5 kg
              </button>
              <button
                class="flex-1 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md font-bold text-center"
                @click="adjustLossQty(10)"
                type="button"
              >
                +10 kg
              </button>
              <button
                class="py-1.5 px-3 rounded-lg bg-error-container text-on-error-container font-label-md text-label-md font-bold"
                @click="lossQuantity = currentLossProduct?.qty || 10"
                type="button"
              >
                Total ({{ currentLossProduct?.qty || 0 }}kg)
              </button>
            </div>
          </div>

          <!-- 3. Motivo da Perda (Radio Cards) -->
          <div class="flex flex-col gap-space-sm">
            <div class="flex items-center justify-between">
              <span
                class="font-label-lg text-label-lg text-on-surface font-semibold flex items-center gap-1.5"
              >
                <span class="material-symbols-outlined text-secondary text-[20px]">
                  report_problem
                </span>
                Motivo da Perda <span class="text-error font-bold">*</span>
              </span>
              <span class="font-label-sm text-label-sm text-on-surface-variant">Obrigatório</span>
            </div>

            <div class="grid grid-cols-1 gap-2.5">
              <label
                v-for="r in [
                  {
                    val: 'maturacao',
                    title: 'Maturação excessiva',
                    sub: 'Passou do ponto / amolecido para venda',
                    icon: 'nest_eco_leaf',
                    iconBg: 'bg-tertiary-container/15 text-tertiary',
                  },
                  {
                    val: 'pragas',
                    title: 'Pragas ou fungos',
                    sub: 'Mofo, broca ou infecção visível',
                    icon: 'bug_report',
                    iconBg: 'bg-error-container/40 text-error',
                  },
                  {
                    val: 'dano',
                    title: 'Dano físico / Transporte',
                    sub: 'Esmagamento de caixa, batidas ou corte',
                    icon: 'broken_image',
                    iconBg: 'bg-secondary-fixed-dim/30 text-secondary',
                  },
                  {
                    val: 'murcha',
                    title: 'Desidratação / Murcha',
                    sub: 'Perda de umidade / sem atratividade',
                    icon: 'water_drop',
                    iconBg: 'bg-tertiary-fixed/60 text-tertiary',
                  },
                  {
                    val: 'inventario',
                    title: 'Ajuste de balanço físico',
                    sub: 'Diferença de conferência ou aferição',
                    icon: 'difference',
                    iconBg: 'bg-surface-container-high text-on-surface-variant',
                  },
                ]"
                :key="r.val"
                class="relative flex items-center p-3 rounded-xl bg-surface-container-lowest shadow-sm cursor-pointer transition-all active:scale-[0.99]"
                :class="lossReason === r.val ? 'bg-secondary-fixed/30' : ''"
              >
                <input v-model="lossReason" class="sr-only" name="reason" type="radio" :value="r.val" />
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center mr-3 shrink-0"
                  :class="r.iconBg"
                >
                  <span class="material-symbols-outlined text-[24px]">{{ r.icon }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <span class="font-label-lg text-label-lg text-on-surface font-bold block truncate">
                    {{ r.title }}
                  </span>
                  <span class="font-body-sm text-body-sm text-on-surface-variant block">
                    {{ r.sub }}
                  </span>
                </div>
                <div
                  class="w-6 h-6 rounded-full flex items-center justify-center"
                  :class="
                    lossReason === r.val
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-transparent'
                  "
                >
                  <span class="material-symbols-outlined text-[16px]">check</span>
                </div>
              </label>
            </div>
          </div>

          <!-- 4. Destino Sustentável do Produto -->
          <div
            class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm"
          >
            <div class="flex items-center justify-between">
              <label class="font-label-lg text-label-lg text-on-surface flex items-center gap-1.5">
                <span class="material-symbols-outlined text-primary text-[20px]">recycling</span>
                Destinação Sustentável
              </label>
              <span
                class="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-bold"
              >
                ESG
              </span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <label
                v-for="dest in [
                  { val: 'compostagem', label: 'Compostagem', icon: 'compost' },
                  { val: 'doacao', label: 'Doação / Cozinha', icon: 'volunteer_activism' },
                  { val: 'racao', label: 'Ração Animal', icon: 'pets' },
                  { val: 'descarte', label: 'Lixo Orgânico', icon: 'delete_sweep' },
                ]"
                :key="dest.val"
                class="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-colors"
                :class="
                  lossDestination === dest.val
                    ? 'bg-primary-fixed text-on-primary-fixed'
                    : 'bg-surface-container-low text-on-surface'
                "
              >
                <input
                  v-model="lossDestination"
                  class="sr-only"
                  name="destination"
                  type="radio"
                  :value="dest.val"
                />
                <span class="material-symbols-outlined text-[20px]">{{ dest.icon }}</span>
                <span class="font-label-md text-label-md font-semibold truncate">
                  {{ dest.label }}
                </span>
              </label>
            </div>
          </div>

          <!-- 5. Foto de Evidência & Observações -->
          <div
            class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm"
          >
            <span
              class="font-label-lg text-label-lg text-on-surface font-semibold flex items-center gap-1.5"
            >
              <span class="material-symbols-outlined text-outline text-[20px]">add_a_photo</span>
              Evidência e Observação
            </span>
            <div class="flex items-center gap-space-sm">
              <label
                class="w-20 h-20 rounded-xl bg-surface-container-low flex flex-col items-center justify-center text-on-surface-variant cursor-pointer active:bg-surface-container transition-colors shrink-0"
              >
                <input
                  accept="image/*"
                  capture="environment"
                  class="sr-only"
                  @change="handleLossPhotoUpload"
                  type="file"
                />
                <span class="material-symbols-outlined text-[26px] text-primary">photo_camera</span>
                <span class="font-label-sm text-label-sm font-semibold mt-1">Anexar</span>
              </label>

              <div
                v-if="lossPhotoPreview"
                class="relative w-20 h-20 rounded-xl overflow-hidden shadow-sm shrink-0"
              >
                <img class="w-full h-full object-cover" :src="lossPhotoPreview" alt="Preview" />
                <button
                  @click="lossPhotoPreview = ''"
                  class="absolute top-1 right-1 w-5 h-5 rounded-full bg-error text-on-error flex items-center justify-center shadow-md"
                  type="button"
                >
                  <span class="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>

              <div class="flex-1 min-w-0">
                <textarea
                  v-model="lossNotes"
                  class="w-full h-20 p-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm resize-none focus:outline-none placeholder:text-outline"
                  placeholder="Observações opcionais (ex: Caixa veio prensada no palete 04)..."
                  rows="2"
                ></textarea>
              </div>
            </div>
          </div>

          <!-- 6. Prejuízo Calculado (Live Impact Banner) -->
          <div
            class="bg-error-container/30 rounded-xl p-space-md shadow-sm flex items-center justify-between"
          >
            <div class="flex items-center gap-space-sm">
              <div
                class="w-12 h-12 rounded-xl bg-error-container text-on-error-container flex items-center justify-center shrink-0"
              >
                <span class="material-symbols-outlined text-[26px]">trending_down</span>
              </div>
              <div>
                <span
                  class="font-label-sm text-label-sm text-error font-bold uppercase tracking-wider block"
                >
                  Impacto Financeiro
                </span>
                <span class="font-body-sm text-body-sm text-on-surface-variant block">
                  Base: R$
                  {{ Number(currentLossProduct?.salePrice || 6.5).toFixed(2).replace('.', ',') }}/{{ currentLossProduct?.unit }}
                </span>
              </div>
            </div>
            <div class="text-right">
              <span class="font-label-sm text-label-sm text-error font-semibold block">
                Prejuízo Estimado
              </span>
              <span
                class="font-headline-lg-mobile text-headline-lg-mobile text-error font-extrabold tracking-tight"
              >
                R$ {{ estimatedLossCostBrl }}
              </span>
            </div>
          </div>

          <!-- Action Button -->
          <div class="pt-space-sm">
            <button
              class="w-full h-14 rounded-xl bg-secondary-container text-on-secondary-container font-headline-sm text-headline-sm font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all hover:opacity-95"
              type="submit"
            >
              <span class="material-symbols-outlined text-[24px]">delete_forever</span>
              Confirmar Baixa de Estoque
            </button>
            <p class="font-body-sm text-body-sm text-outline text-center mt-2">
              Esta operação atualizará o saldo físico em tempo real.
            </p>
          </div>
        </form>

        <!-- Modal de Confirmação Segura (Bottom Sheet) -->
        <div
          v-if="showConfirmLossModal"
          class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
        >
          <div
            class="w-full max-w-lg bg-surface-container-lowest rounded-t-3xl p-space-md flex flex-col gap-space-md shadow-2xl"
          >
            <div class="w-12 h-1.5 bg-surface-container-highest rounded-full mx-auto -mt-1"></div>
            <div class="flex items-center gap-space-sm">
              <div
                class="w-12 h-12 rounded-full bg-error-container text-error flex items-center justify-center shrink-0"
              >
                <span class="material-symbols-outlined text-[28px]">warning</span>
              </div>
              <div>
                <h2 class="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Confirmar Descarte?
                </h2>
                <p class="font-body-sm text-body-sm text-on-surface-variant">
                  Confira os valores antes de efetivar o lançamento.
                </p>
              </div>
            </div>
            <div class="bg-surface-container-low rounded-xl p-space-md flex flex-col gap-2">
              <div class="flex justify-between items-center">
                <span class="font-body-md text-body-md text-on-surface-variant">Produto</span>
                <span class="font-label-lg text-label-lg text-on-surface font-bold">
                  {{ currentLossProduct?.name }}
                </span>
              </div>
              <div class="flex justify-between items-center">
                <span class="font-body-md text-body-md text-on-surface-variant">
                  Quantidade a abater
                </span>
                <span class="font-label-lg text-label-lg text-error font-bold">
                  {{ Number(lossQuantity).toFixed(2) }} {{ currentLossProduct?.unit }}
                </span>
              </div>
              <div class="flex justify-between items-center">
                <span class="font-body-md text-body-md text-on-surface-variant">
                  Novo saldo em estoque
                </span>
                <span class="font-label-lg text-label-lg text-primary font-bold">
                  {{ remainingStockAfterLoss }} {{ currentLossProduct?.unit }}
                </span>
              </div>
              <div class="flex justify-between items-center">
                <span class="font-body-md text-body-md text-on-surface-variant">
                  Prejuízo contábil
                </span>
                <span class="font-label-lg text-label-lg text-error font-extrabold">
                  R$ {{ estimatedLossCostBrl }}
                </span>
              </div>
            </div>
            <div class="flex flex-col gap-2 pt-space-xs">
              <button
                class="w-full h-12 rounded-xl bg-error text-on-error font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md"
                @click="executeFinalLoss"
                type="button"
              >
                <span class="material-symbols-outlined text-[20px]">check_circle</span>
                Sim, Realizar Baixa Imediata
              </button>
              <button
                class="w-full h-12 rounded-xl bg-surface-container text-on-surface font-label-lg text-label-lg font-semibold"
                @click="showConfirmLossModal = false"
                type="button"
              >
                Cancelar e Revisar
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ====================================================================
           TELA 4: EXPORTAR LISTA & RELATÓRIOS (exportar_lista_relat_rios/code.html)
           ==================================================================== -->
      <div v-else-if="currentScreen === 'exportar'" class="flex flex-col w-full pb-8">
        <!-- Cabeçalho Contextual -->
        <div class="px-margin-mobile pt-2 pb-4">
          <div
            class="flex items-center gap-space-xs text-primary font-label-md text-label-md uppercase tracking-wider mb-1"
          >
            <span class="material-symbols-outlined text-[16px]">file_download</span>
            <span>Central de Dados</span>
          </div>
          <h1 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight">
            Exportar Relatórios &amp; Listas
          </h1>
          <p class="font-body-md text-body-md text-on-surface-variant mt-1">
            Selecione os itens da lista de pedido, copie o texto ou compartilhe direto no WhatsApp.
          </p>
        </div>

        <!-- Banner Informativo Suave -->
        <div
          class="mx-margin-mobile mb-6 p-space-md rounded-xl bg-surface-container-low shadow-sm flex items-start gap-3"
        >
          <div
            class="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center shrink-0 text-primary"
          >
            <span class="material-symbols-outlined text-[20px]">sync</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-label-lg text-label-lg text-on-surface">Dados Sincronizados</div>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Conferência de balança e caixas pronta para envio rápido por mensagem.
            </p>
          </div>
        </div>

        <!-- Seleção do Tipo de Relatório -->
        <div class="px-margin-mobile mb-6">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-headline-sm text-headline-sm text-on-surface">Tipo de Relatório / Lista</h2>
            <span
              class="font-label-sm text-label-sm text-primary uppercase bg-surface-container px-2 py-0.5 rounded-full font-bold"
            >
              1 de 4 selecionado
            </span>
          </div>

          <div class="grid grid-cols-1 gap-space-sm">
            <!-- 1. Lista de Compras / Reposição (Pedido WhatsApp) -->
            <div
              @click="selectedReportType = 'compras'"
              class="cursor-pointer p-space-md rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-all relative overflow-hidden active:scale-[0.99] border-l-4"
              :style="{
                borderLeftColor: selectedReportType === 'compras' ? '#006b2c' : 'transparent',
              }"
            >
              <div class="flex items-start gap-space-md">
                <div
                  class="w-11 h-11 rounded-lg bg-primary-fixed flex items-center justify-center text-on-primary-fixed shrink-0 shadow-sm"
                >
                  <span class="material-symbols-outlined text-[24px]">shopping_cart_checkout</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span class="font-label-lg text-label-lg text-on-surface font-bold">
                      Lista de Reposição &amp; Compras (Pedido)
                    </span>
                    <span
                      v-if="selectedReportType === 'compras'"
                      class="material-symbols-outlined text-primary text-[20px]"
                    >
                      check_circle
                    </span>
                  </div>
                  <p class="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-snug">
                    Selecione abaixo os produtos e quantidades para copiar ou enviar a lista de pedido no WhatsApp.
                  </p>
                  <div class="flex items-center gap-2 mt-2">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-label-sm bg-secondary-fixed text-on-secondary-fixed font-bold"
                    >
                      {{ store.selectedOrderItems.length }} Itens na lista
                    </span>
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-label-sm bg-surface-container text-on-surface-variant"
                    >
                      Pronto p/ WhatsApp
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. Inventário Completo -->
            <div
              @click="selectedReportType = 'inventario'"
              class="cursor-pointer p-space-md rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-all relative overflow-hidden active:scale-[0.99] border-l-4"
              :style="{
                borderLeftColor: selectedReportType === 'inventario' ? '#006b2c' : 'transparent',
              }"
            >
              <div class="flex items-start gap-space-md">
                <div
                  class="w-11 h-11 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant shrink-0"
                >
                  <span class="material-symbols-outlined text-[24px]">inventory_2</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span class="font-label-lg text-label-lg text-on-surface font-bold">
                      Inventário Completo
                    </span>
                    <span
                      v-if="selectedReportType === 'inventario'"
                      class="material-symbols-outlined text-primary text-[20px]"
                    >
                      check_circle
                    </span>
                  </div>
                  <p class="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-snug">
                    Todas as frutas, verduras e legumes com saldo físico atual e valoração estimada.
                  </p>
                </div>
              </div>
            </div>

            <!-- 3. Perdas & Desperdício -->
            <div
              @click="selectedReportType = 'perdas'"
              class="cursor-pointer p-space-md rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-all relative overflow-hidden active:scale-[0.99] border-l-4"
              :style="{
                borderLeftColor: selectedReportType === 'perdas' ? '#006b2c' : 'transparent',
              }"
            >
              <div class="flex items-start gap-space-md">
                <div
                  class="w-11 h-11 rounded-lg bg-error-container flex items-center justify-center text-on-error-container shrink-0"
                >
                  <span class="material-symbols-outlined text-[24px]">delete_sweep</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span class="font-label-lg text-label-lg text-on-surface font-bold">
                      Perdas &amp; Desperdício
                    </span>
                    <span
                      v-if="selectedReportType === 'perdas'"
                      class="material-symbols-outlined text-primary text-[20px]"
                    >
                      check_circle
                    </span>
                  </div>
                  <p class="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-snug">
                    Detalhamento de motivos (avaria, podridão, desidratação), custos e descarte por lote.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Seleção Rápida dos Itens para o Pedido (Checklist Interativo) -->
        <div class="px-margin-mobile mb-6">
          <div class="p-space-md rounded-xl bg-surface-container-lowest shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-[20px]">checklist</span>
                Selecionar Produtos para a Lista
              </h2>
              <button
                @click="currentScreen = 'cadastrar'"
                class="font-label-sm text-label-sm text-primary hover:underline font-bold"
                type="button"
              >
                + Cadastrar Item
              </button>
            </div>

            <div class="space-y-2">
              <div
                v-for="p in store.products"
                :key="p.id"
                class="flex items-center justify-between p-2.5 rounded-xl transition-colors"
                :class="
                  store.orderSelection[p.id]?.selected
                    ? 'bg-primary-fixed/30'
                    : 'bg-surface-container-low'
                "
              >
                <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                  <input
                    type="checkbox"
                    :checked="store.orderSelection[p.id]?.selected"
                    @change="store.toggleOrderSelect(p)"
                    class="w-5 h-5 rounded accent-primary cursor-pointer"
                  />
                  <span class="text-[18px]">{{ p.emoji }}</span>
                  <div class="truncate">
                    <span class="font-label-md text-label-md text-on-surface font-bold block truncate">
                      {{ p.name }}
                    </span>
                    <span class="font-body-sm text-body-sm text-on-surface-variant">
                      Estoque: {{ p.qty }} {{ p.unitLabel }}
                    </span>
                  </div>
                </label>

                <!-- Stepper da quantidade do pedido quando marcado -->
                <div
                  v-if="store.orderSelection[p.id]?.selected"
                  class="flex items-center gap-1.5 shrink-0"
                >
                  <button
                    type="button"
                    @click="store.updateOrderItemQty(p.id, -1)"
                    class="w-7 h-7 rounded-lg bg-surface-container-lowest text-on-surface font-bold shadow-xs"
                  >
                    -
                  </button>
                  <input
                    v-model.number="store.orderSelection[p.id].orderQty"
                    @change="store.saveState()"
                    type="number"
                    min="1"
                    class="w-10 text-center font-label-lg text-label-lg font-bold text-primary bg-transparent focus:outline-none"
                  />
                  <button
                    type="button"
                    @click="store.updateOrderItemQty(p.id, 1)"
                    class="w-7 h-7 rounded-lg bg-primary text-on-primary font-bold shadow-xs"
                  >
                    +
                  </button>
                  <select
                    v-model="store.orderSelection[p.id].orderUnit"
                    @change="store.saveState()"
                    class="h-7 px-1.5 rounded-lg bg-surface-container-lowest font-label-sm text-label-sm text-on-surface focus:outline-none"
                  >
                    <option value="cx">cx</option>
                    <option value="sc">sc</option>
                    <option value="kg">kg</option>
                    <option value="un">un</option>
                    <option value="maços">maços</option>
                    <option value="engradados">engrad.</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Filtros Personalizáveis (Idêntico ao Stitch) -->
        <div class="px-margin-mobile mb-6">
          <div class="p-space-md rounded-xl bg-surface-container-lowest shadow-sm space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-[20px]">tune</span>
                Filtros da Seleção
              </h2>
              <button
                class="font-label-sm text-label-sm text-primary hover:underline"
                @click="resetExportFilters"
                type="button"
              >
                Restaurar
              </button>
            </div>

            <!-- Categorias Hortifrúti -->
            <div>
              <label class="font-label-md text-label-md text-on-surface-variant block mb-2">
                Categorias Ativas
              </label>
              <div class="grid grid-cols-3 gap-2">
                <label
                  v-for="cat in [
                    { key: 'frutas', label: 'Frutas', emoji: '🍎' },
                    { key: 'verduras', label: 'Verduras', emoji: '🥬' },
                    { key: 'legumes', label: 'Legumes', emoji: '🥕' },
                  ]"
                  :key="cat.key"
                  class="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low cursor-pointer hover:bg-surface-container transition-colors select-none"
                >
                  <div class="flex items-center gap-2">
                    <span class="text-[18px]">{{ cat.emoji }}</span>
                    <span class="font-label-md text-label-md text-on-surface">{{ cat.label }}</span>
                  </div>
                  <input
                    :checked="activeExportCategories.includes(cat.key)"
                    @change="toggleExportCategory(cat.key)"
                    class="w-4 h-4 rounded text-primary focus:ring-0 accent-primary cursor-pointer"
                    type="checkbox"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Formato de Saída -->
        <div class="px-margin-mobile mb-6">
          <h2 class="font-headline-sm text-headline-sm text-on-surface mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[20px]">output</span>
            Formato do Documento
          </h2>
          <div class="grid grid-cols-1 gap-2.5">
            <!-- Opção 1: Texto Simples / WhatsApp -->
            <label
              class="flex items-center gap-3 p-space-md rounded-xl bg-surface-container-lowest shadow-sm cursor-pointer hover:shadow-md transition-all"
            >
              <input
                v-model="selectedOutputFormat"
                class="hidden peer"
                name="export-format"
                type="radio"
                value="whatsapp"
              />
              <div
                class="w-5 h-5 rounded-full border-2 border-outline flex items-center justify-center peer-checked:border-primary peer-checked:bg-primary shrink-0 transition-all"
              >
                <div class="w-2 h-2 rounded-full bg-surface-container-lowest"></div>
              </div>
              <div
                class="w-10 h-10 rounded-lg bg-surface-container-highest text-primary flex items-center justify-center shrink-0"
              >
                <span class="material-symbols-outlined text-[22px]">chat</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <span class="font-label-lg text-label-lg text-on-surface font-bold">
                    Texto Simples / WhatsApp
                  </span>
                  <span
                    class="font-label-sm text-label-sm text-secondary bg-secondary-fixed px-2 py-0.5 rounded-full font-bold"
                  >
                    Direto
                  </span>
                </div>
                <span class="font-body-sm text-body-sm text-on-surface-variant block mt-0.5">
                  Mensagem formatada com emojis e quebra de linhas para copiar ou enviar no WhatsApp.
                </span>
              </div>
            </label>

            <!-- Opção 2: Excel / CSV -->
            <label
              class="flex items-center gap-3 p-space-md rounded-xl bg-surface-container-lowest shadow-sm cursor-pointer hover:shadow-md transition-all"
            >
              <input
                v-model="selectedOutputFormat"
                class="hidden peer"
                name="export-format"
                type="radio"
                value="excel"
              />
              <div
                class="w-5 h-5 rounded-full border-2 border-outline flex items-center justify-center peer-checked:border-primary peer-checked:bg-primary shrink-0 transition-all"
              >
                <div class="w-2 h-2 rounded-full bg-surface-container-lowest"></div>
              </div>
              <div
                class="w-10 h-10 rounded-lg bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0"
              >
                <span class="material-symbols-outlined text-[22px]">table_view</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <span class="font-label-lg text-label-lg text-on-surface font-bold">
                    Planilha Excel / CSV (.csv)
                  </span>
                  <span
                    class="font-label-sm text-label-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full"
                  >
                    Gerencial
                  </span>
                </div>
                <span class="font-body-sm text-body-sm text-on-surface-variant block mt-0.5">
                  Tabelas dinâmicas com quantidades em estoque e pedido.
                </span>
              </div>
            </label>

            <!-- Opção 3: PDF -->
            <label
              class="flex items-center gap-3 p-space-md rounded-xl bg-surface-container-lowest shadow-sm cursor-pointer hover:shadow-md transition-all"
            >
              <input
                v-model="selectedOutputFormat"
                class="hidden peer"
                name="export-format"
                type="radio"
                value="pdf"
              />
              <div
                class="w-5 h-5 rounded-full border-2 border-outline flex items-center justify-center peer-checked:border-primary peer-checked:bg-primary shrink-0 transition-all"
              >
                <div class="w-2 h-2 rounded-full bg-surface-container-lowest"></div>
              </div>
              <div
                class="w-10 h-10 rounded-lg bg-error-container text-on-error-container flex items-center justify-center shrink-0"
              >
                <span class="material-symbols-outlined text-[22px]">picture_as_pdf</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <span class="font-label-lg text-label-lg text-on-surface font-bold">
                    PDF Formatado
                  </span>
                  <span
                    class="font-label-sm text-label-sm text-primary bg-primary-fixed px-2 py-0.5 rounded-full font-bold"
                  >
                    Imprimir
                  </span>
                </div>
                <span class="font-body-sm text-body-sm text-on-surface-variant block mt-0.5">
                  Layout A4 pronto com cabeçalho oficial para impressão.
                </span>
              </div>
            </label>
          </div>
        </div>

        <!-- Pré-visualização Compacta do Texto p/ Copiar e WhatsApp -->
        <div class="px-margin-mobile mb-6">
          <div class="rounded-xl bg-surface-container-lowest shadow-sm p-space-md">
            <div class="flex items-center justify-between pb-3">
              <div>
                <span
                  class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block"
                >
                  Prévia da Lista p/ Copiar ou WhatsApp
                </span>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="font-headline-sm text-headline-sm text-on-surface">
                    {{ store.selectedOrderItems.length }} Itens selecionados
                  </span>
                  <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                </div>
              </div>
              <span
                class="font-label-md text-label-md text-primary bg-primary-fixed px-2.5 py-1 rounded-full font-bold uppercase"
              >
                {{ selectedOutputFormat }}
              </span>
            </div>

            <div
              class="mt-2 p-3 rounded-xl bg-surface-container-low font-mono text-body-sm text-on-surface whitespace-pre-wrap select-all"
            >
              {{ previewWhatsAppText }}
            </div>
          </div>
        </div>

        <!-- Ações Principais (Copiar / Baixar + Enviar no WhatsApp) -->
        <div class="px-margin-mobile space-y-3">
          <button
            @click="handleCopyOrDownload"
            class="w-full h-12 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-lg text-label-lg flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all"
            type="button"
          >
            <span class="material-symbols-outlined text-[22px]">
              {{ selectedOutputFormat === 'whatsapp' ? 'content_copy' : 'download' }}
            </span>
            <span>
              {{
                selectedOutputFormat === 'whatsapp'
                  ? 'Copiar Lista para Colar'
                  : selectedOutputFormat === 'excel'
                    ? 'Baixar Planilha (.CSV)'
                    : 'Imprimir / Salvar PDF'
              }}
            </span>
          </button>

          <button
            @click="handleSendWhatsAppDirect"
            class="w-full h-12 bg-surface-container hover:bg-surface-container-high text-primary rounded-lg font-label-lg text-label-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm"
            type="button"
          >
            <span class="material-symbols-outlined text-[22px]">share</span>
            <span>Compartilhar no WhatsApp</span>
          </button>
        </div>
      </div>
    </main>

    <!-- ======================================================================
         MODAL CALCULADORA DE BALANÇA & TARA OPCIONAL (ESTILO AGROFRESH)
         ====================================================================== -->
    <div
      v-if="showScaleCalcModal"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
    >
      <div
        class="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl p-space-md shadow-2xl space-y-4"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div
              class="w-9 h-9 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center"
            >
              <span class="material-symbols-outlined text-[20px]">calculate</span>
            </div>
            <div>
              <h3 class="font-headline-sm text-headline-sm text-on-surface">
                {{
                  calcContext.product
                    ? `Calculadora: ${calcContext.product.name}`
                    : 'Calculadora de Pesagem & Tara'
                }}
              </h3>
              <p class="font-body-sm text-body-sm text-on-surface-variant">
                Some pesagens na balança e desconte caixas vazias se precisar
              </p>
            </div>
          </div>
          <button
            @click="showScaleCalcModal = false"
            class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant"
          >
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <!-- 1. Peso na Balança -->
        <div class="space-y-2">
          <label class="font-label-md text-label-md text-on-surface block">
            Peso Bruto na Balança (kg)
          </label>
          <div class="flex items-center gap-2">
            <input
              v-model="calcWeightInput"
              @keyup.enter="addCalcBatch"
              type="number"
              step="0.05"
              placeholder="Ex: 21.5"
              class="flex-1 h-12 px-4 rounded-xl bg-surface-container-low text-headline-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              @click="addCalcBatch"
              class="h-12 px-3.5 rounded-xl bg-surface-container text-primary font-label-md text-label-md font-bold active:scale-95 transition"
            >
              + Somar Lote
            </button>
          </div>

          <div v-if="calcBatches.length > 0" class="flex flex-wrap gap-1.5 pt-1">
            <span
              v-for="(b, idx) in calcBatches"
              :key="idx"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm"
            >
              {{ b }} kg
              <button @click="removeCalcBatch(idx)" class="text-error font-bold ml-1">×</button>
            </span>
          </div>
        </div>

        <!-- 2. Desconto de Tara Opcional -->
        <div class="grid grid-cols-2 gap-3 p-3 rounded-xl bg-surface-container-low">
          <div>
            <label class="font-label-sm text-label-sm text-on-surface-variant block mb-1">
              Qtd Caixas / Cestos
            </label>
            <input
              v-model.number="calcCratesCount"
              type="number"
              min="0"
              class="w-full h-10 px-3 rounded-lg bg-surface-container-lowest font-label-lg text-on-surface focus:outline-none"
            />
          </div>
          <div>
            <label class="font-label-sm text-label-sm text-on-surface-variant block mb-1">
              Tara de 1 Caixa Vazia (kg)
            </label>
            <input
              v-model.number="calcTarePerCrate"
              type="number"
              step="0.05"
              min="0"
              placeholder="0.0 (Opcional)"
              class="w-full h-10 px-3 rounded-lg bg-surface-container-lowest font-label-lg text-on-surface focus:outline-none"
            />
          </div>
        </div>

        <!-- Resultado Líquido -->
        <div class="p-3.5 rounded-xl bg-primary-fixed/40 flex items-center justify-between">
          <div class="font-body-sm text-body-sm text-on-surface-variant">
            <div>Bruto: <strong>{{ calcGrossWeight }} kg</strong></div>
            <div v-if="calcTotalTare > 0" class="text-secondary font-semibold">
              (-) Tara: -{{ calcTotalTare }} kg
            </div>
          </div>
          <div class="text-right">
            <span class="font-label-sm text-label-sm uppercase text-primary block">
              Peso Líquido Real
            </span>
            <span class="font-headline-lg-mobile text-headline-lg-mobile text-primary font-extrabold">
              {{ calcNetWeight }} kg
            </span>
          </div>
        </div>

        <button
          type="button"
          @click="applyCalculatorResult"
          :disabled="calcNetWeight <= 0"
          class="w-full h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-bold shadow-md disabled:opacity-40 active:scale-98 transition"
        >
          Confirmar {{ calcNetWeight }} kg
        </button>
      </div>
    </div>

    <!-- ======================================================================
         TOAST DE FEEDBACK OPERACIONAL (IDÊNTICO AO STITCH)
         ====================================================================== -->
    <div
      class="fixed bottom-20 left-4 right-4 max-w-sm mx-auto bg-inverse-surface text-inverse-on-surface p-4 rounded-xl shadow-xl flex items-center justify-between gap-3 transition-all duration-300 z-50"
      :class="
        store.toast.show
          ? 'translate-y-0 opacity-100'
          : 'translate-y-24 opacity-0 pointer-events-none'
      "
    >
      <div class="flex items-center gap-3 min-w-0">
        <div
          class="w-8 h-8 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0"
        >
          <span class="material-symbols-outlined text-[18px]">{{ store.toast.icon }}</span>
        </div>
        <div class="flex flex-col min-w-0">
          <span class="font-label-md text-label-md font-bold truncate">
            {{ store.toast.title }}
          </span>
          <span
            v-if="store.toast.desc"
            class="font-body-sm text-body-sm text-inverse-on-surface/80 truncate"
          >
            {{ store.toast.desc }}
          </span>
        </div>
      </div>
      <button
        @click="store.hideToast()"
        class="text-inverse-on-surface/80 hover:text-inverse-on-surface"
        type="button"
      >
        <span class="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>

    <!-- ======================================================================
         BOTTOM NAVIGATION BAR (4 ABAS IDÊNTICAS AO STITCH)
         ====================================================================== -->
    <nav
      class="fixed bottom-0 inset-x-0 z-50 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-2px_12px_rgba(0,0,0,0.04)]"
    >
      <div class="flex items-center justify-around h-16 px-space-xs max-w-2xl mx-auto">
        <button
          @click="currentScreen = 'estoque'"
          class="flex-1 flex flex-col items-center justify-center h-full gap-0.5 transition-colors min-w-[44px]"
          :class="
            currentScreen === 'estoque'
              ? 'text-primary font-bold'
              : 'text-on-surface-variant hover:text-primary'
          "
        >
          <span class="material-symbols-outlined text-[22px]">inventory_2</span>
          <span class="font-label-sm text-label-sm">Estoque</span>
        </button>

        <button
          @click="currentScreen = 'cadastrar'"
          class="flex-1 flex flex-col items-center justify-center h-full gap-0.5 transition-colors min-w-[44px]"
          :class="
            currentScreen === 'cadastrar'
              ? 'text-primary font-bold'
              : 'text-on-surface-variant hover:text-primary'
          "
        >
          <span class="material-symbols-outlined text-[22px]">add_circle</span>
          <span class="font-label-sm text-label-sm">Cadastrar</span>
        </button>

        <button
          @click="currentScreen = 'perdas'"
          class="flex-1 flex flex-col items-center justify-center h-full gap-0.5 transition-colors min-w-[44px] relative"
          :class="
            currentScreen === 'perdas' || currentScreen === 'registrar_baixa'
              ? 'text-primary font-bold'
              : 'text-on-surface-variant hover:text-primary'
          "
        >
          <div class="relative flex items-center justify-center">
            <span class="material-symbols-outlined text-[22px]">report_problem</span>
            <span
              class="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-secondary-container"
            ></span>
          </div>
          <span class="font-label-sm text-label-sm">Perdas</span>
        </button>

        <button
          @click="currentScreen = 'exportar'"
          class="flex-1 flex flex-col items-center justify-center h-full gap-0.5 transition-colors min-w-[44px] relative"
          :class="
            currentScreen === 'exportar'
              ? 'text-primary font-bold'
              : 'text-on-surface-variant hover:text-primary'
          "
        >
          <div class="relative flex items-center justify-center">
            <span class="material-symbols-outlined text-[22px]">file_download</span>
            <span
              v-if="store.selectedOrderItems.length > 0"
              class=" -top-1.5 -right-3 px-1 rounded-full bg-primary text-on-primary font-label-sm text-[9px]"
            >
              {{ store.selectedOrderItems.length }}
            </span>
          </div>
          <span class="font-label-sm text-label-sm">Exportar</span>
        </button>
      </div>
    </nav>

    <!-- Modal Conexão Opcional Supabase -->
    <SupabaseConfigModal :show="showSupabaseModal" @close="showSupabaseModal = false" />
  </div>
</template>
