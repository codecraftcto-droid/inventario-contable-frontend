<script setup>
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import { TextAlign } from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import { Underline } from '@tiptap/extension-underline'
import { StarterKit } from '@tiptap/starter-kit'
import {
  EditorContent,
  useEditor,
} from '@tiptap/vue-3'

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  placeholder: {
    type: String,
    required: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const colorSwatches = [
  '#111827',
  '#374151',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0891b2',
  '#2563eb',
  '#7c3aed',
  '#db2777',
]

const backgroundSwatches = [
  '#ffffff',
  '#f3f4f6',
  '#fee2e2',
  '#ffedd5',
  '#fef3c7',
  '#dcfce7',
  '#cffafe',
  '#dbeafe',
  '#ede9fe',
  '#fce7f3',
]

const StyledTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: element => element.style.backgroundColor || null,
        renderHTML: attributes => attributes.backgroundColor ? { style: `background-color: ${attributes.backgroundColor}` } : {},
      },
      borderColor: {
        default: null,
        parseHTML: element => element.style.borderColor || null,
        renderHTML: attributes => attributes.borderColor ? { style: `border-color: ${attributes.borderColor}` } : {},
      },
    }
  },
})

const StyledTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: element => element.style.backgroundColor || null,
        renderHTML: attributes => attributes.backgroundColor ? { style: `background-color: ${attributes.backgroundColor}` } : {},
      },
      borderColor: {
        default: null,
        parseHTML: element => element.style.borderColor || null,
        renderHTML: attributes => attributes.borderColor ? { style: `border-color: ${attributes.borderColor}` } : {},
      },
    }
  },
})

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    TextAlign.configure({
      types: [
        'heading',
        'paragraph',
      ],
    }),
    Placeholder.configure({ placeholder: props.placeholder ?? 'Escriba el contenido del documento...' }),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Link.configure({
      openOnClick: true,
      autolink: true,
      defaultProtocol: 'https',
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
    }),
    Table.configure({
      resizable: true,
      lastColumnResizable: true,
    }),
    TableRow,
    StyledTableHeader,
    StyledTableCell,
    Subscript,
    Superscript,
  ],
  onUpdate() {
    if (!editor.value)
      return

    emit('update:modelValue', editor.value.getHTML())
  },
})

const syncContent = value => {
  const current = editor.value?.getHTML()

  if (!editor.value || current === value)
    return

  editor.value.commands.setContent(value, false)
}

const promptLink = () => {
  if (!editor.value)
    return

  const previousUrl = editor.value.getAttributes('link').href ?? ''
  const url = globalThis.prompt('Ingrese la URL del enlace', previousUrl)

  if (url === null)
    return

  if (!url.trim()) {
    editor.value.chain().focus().unsetLink().run()

    return
  }

  editor.value.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
}

const promptImage = () => {
  if (!editor.value)
    return

  const url = globalThis.prompt('Ingrese la URL de la imagen')

  if (!url?.trim())
    return

  editor.value.chain().focus().setImage({ src: url.trim() }).run()
}

const setCellAttribute = (attribute, value) => {
  if (!editor.value)
    return

  editor.value.chain().focus().updateAttributes('tableCell', { [attribute]: value }).run()
  editor.value.chain().focus().updateAttributes('tableHeader', { [attribute]: value }).run()
}

watch(() => props.modelValue, syncContent)

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div class="editor-shell border rounded">
    <div
      v-if="editor"
      class="d-flex gap-2 py-3 px-4 flex-wrap align-center editor-toolbar"
    >
      <IconBtn
        size="small"
        :variant="editor.isActive('heading', { level: 1 }) ? 'tonal' : 'text'"
        :color="editor.isActive('heading', { level: 1 }) ? 'primary' : 'default'"
        @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
      >
        <VIcon icon="tabler-h-1" />
      </IconBtn>

      <IconBtn
        size="small"
        :variant="editor.isActive('heading', { level: 2 }) ? 'tonal' : 'text'"
        :color="editor.isActive('heading', { level: 2 }) ? 'primary' : 'default'"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
      >
        <VIcon icon="tabler-h-2" />
      </IconBtn>

      <IconBtn
        size="small"
        :variant="editor.isActive('bold') ? 'tonal' : 'text'"
        :color="editor.isActive('bold') ? 'primary' : 'default'"
        @click="editor.chain().focus().toggleBold().run()"
      >
        <VIcon icon="tabler-bold" />
      </IconBtn>

      <IconBtn
        size="small"
        :variant="editor.isActive('underline') ? 'tonal' : 'text'"
        :color="editor.isActive('underline') ? 'primary' : 'default'"
        @click="editor.chain().focus().toggleUnderline().run()"
      >
        <VIcon icon="tabler-underline" />
      </IconBtn>

      <IconBtn
        size="small"
        :variant="editor.isActive('italic') ? 'tonal' : 'text'"
        :color="editor.isActive('italic') ? 'primary' : 'default'"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <VIcon icon="tabler-italic" />
      </IconBtn>

      <IconBtn
        size="small"
        :variant="editor.isActive('strike') ? 'tonal' : 'text'"
        :color="editor.isActive('strike') ? 'primary' : 'default'"
        @click="editor.chain().focus().toggleStrike().run()"
      >
        <VIcon icon="tabler-strikethrough" />
      </IconBtn>

      <IconBtn
        size="small"
        :variant="editor.isActive('highlight') ? 'tonal' : 'text'"
        :color="editor.isActive('highlight') ? 'warning' : 'default'"
        @click="editor.chain().focus().toggleHighlight().run()"
      >
        <VIcon icon="tabler-highlight" />
      </IconBtn>

      <VMenu :close-on-content-click="false">
        <template #activator="{ props: menuProps }">
          <IconBtn size="small" variant="text" v-bind="menuProps">
            <VIcon icon="tabler-text-color" />
            <VTooltip activator="parent" location="top">
              Color de texto
            </VTooltip>
          </IconBtn>
        </template>
        <VCard min-width="220">
          <VCardText class="d-flex flex-wrap gap-2">
            <button
              v-for="color in colorSwatches"
              :key="`text-${color}`"
              type="button"
              class="editor-color-swatch"
              :style="{ backgroundColor: color }"
              @click="editor.chain().focus().setColor(color).run()"
            />
            <VBtn size="small" variant="tonal" color="secondary" @click="editor.chain().focus().unsetColor().run()">
              Quitar
            </VBtn>
          </VCardText>
        </VCard>
      </VMenu>

      <VMenu :close-on-content-click="false">
        <template #activator="{ props: menuProps }">
          <IconBtn size="small" variant="text" v-bind="menuProps">
            <VIcon icon="tabler-highlight" />
            <VTooltip activator="parent" location="top">
              Color de resaltado
            </VTooltip>
          </IconBtn>
        </template>
        <VCard min-width="220">
          <VCardText class="d-flex flex-wrap gap-2">
            <button
              v-for="color in backgroundSwatches"
              :key="`highlight-${color}`"
              type="button"
              class="editor-color-swatch"
              :style="{ backgroundColor: color }"
              @click="editor.chain().focus().setHighlight({ color }).run()"
            />
            <VBtn size="small" variant="tonal" color="secondary" @click="editor.chain().focus().unsetHighlight().run()">
              Quitar
            </VBtn>
          </VCardText>
        </VCard>
      </VMenu>

      <IconBtn
        size="small"
        :variant="editor.isActive('subscript') ? 'tonal' : 'text'"
        :color="editor.isActive('subscript') ? 'primary' : 'default'"
        @click="editor.chain().focus().toggleSubscript().run()"
      >
        <VIcon icon="tabler-subscript" />
      </IconBtn>

      <IconBtn
        size="small"
        :variant="editor.isActive('superscript') ? 'tonal' : 'text'"
        :color="editor.isActive('superscript') ? 'primary' : 'default'"
        @click="editor.chain().focus().toggleSuperscript().run()"
      >
        <VIcon icon="tabler-superscript" />
      </IconBtn>

      <VDivider vertical inset class="mx-1" />

      <IconBtn
        size="small"
        :variant="editor.isActive('bulletList') ? 'tonal' : 'text'"
        :color="editor.isActive('bulletList') ? 'primary' : 'default'"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        <VIcon icon="tabler-list" />
      </IconBtn>

      <IconBtn
        size="small"
        :variant="editor.isActive('orderedList') ? 'tonal' : 'text'"
        :color="editor.isActive('orderedList') ? 'primary' : 'default'"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        <VIcon icon="tabler-list-numbers" />
      </IconBtn>

      <IconBtn
        size="small"
        :variant="editor.isActive('blockquote') ? 'tonal' : 'text'"
        :color="editor.isActive('blockquote') ? 'primary' : 'default'"
        @click="editor.chain().focus().toggleBlockquote().run()"
      >
        <VIcon icon="tabler-blockquote" />
      </IconBtn>

      <IconBtn
        size="small"
        :variant="editor.isActive('codeBlock') ? 'tonal' : 'text'"
        :color="editor.isActive('codeBlock') ? 'primary' : 'default'"
        @click="editor.chain().focus().toggleCodeBlock().run()"
      >
        <VIcon icon="tabler-code" />
      </IconBtn>

      <IconBtn
        size="small"
        variant="text"
        @click="editor.chain().focus().setHorizontalRule().run()"
      >
        <VIcon icon="tabler-minus" />
      </IconBtn>

      <VDivider vertical inset class="mx-1" />

      <IconBtn
        size="small"
        :variant="editor.isActive({ textAlign: 'left' }) ? 'tonal' : 'text'"
        :color="editor.isActive({ textAlign: 'left' }) ? 'primary' : 'default'"
        @click="editor.chain().focus().setTextAlign('left').run()"
      >
        <VIcon icon="tabler-align-left" />
      </IconBtn>

      <IconBtn
        size="small"
        :variant="editor.isActive({ textAlign: 'center' }) ? 'tonal' : 'text'"
        :color="editor.isActive({ textAlign: 'center' }) ? 'primary' : 'default'"
        @click="editor.chain().focus().setTextAlign('center').run()"
      >
        <VIcon icon="tabler-align-center" />
      </IconBtn>

      <IconBtn
        size="small"
        :variant="editor.isActive({ textAlign: 'right' }) ? 'tonal' : 'text'"
        :color="editor.isActive({ textAlign: 'right' }) ? 'primary' : 'default'"
        @click="editor.chain().focus().setTextAlign('right').run()"
      >
        <VIcon icon="tabler-align-right" />
      </IconBtn>

      <IconBtn
        size="small"
        :variant="editor.isActive({ textAlign: 'justify' }) ? 'tonal' : 'text'"
        :color="editor.isActive({ textAlign: 'justify' }) ? 'primary' : 'default'"
        @click="editor.chain().focus().setTextAlign('justify').run()"
      >
        <VIcon icon="tabler-align-justified" />
      </IconBtn>

      <VDivider vertical inset class="mx-1" />

      <IconBtn
        size="small"
        :variant="editor.isActive('link') ? 'tonal' : 'text'"
        :color="editor.isActive('link') ? 'primary' : 'default'"
        @click="promptLink"
      >
        <VIcon icon="tabler-link" />
      </IconBtn>

      <IconBtn
        size="small"
        variant="text"
        @click="editor.chain().focus().unsetLink().run()"
      >
        <VIcon icon="tabler-link-off" />
      </IconBtn>

      <IconBtn
        size="small"
        variant="text"
        @click="promptImage"
      >
        <VIcon icon="tabler-photo-plus" />
      </IconBtn>

      <VDivider vertical inset class="mx-1" />

      <IconBtn
        size="small"
        :variant="editor.isActive('table') ? 'tonal' : 'text'"
        :color="editor.isActive('table') ? 'primary' : 'default'"
        @click="editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()"
      >
        <VIcon icon="tabler-table-plus" />
        <VTooltip activator="parent" location="top">
          Insertar tabla
        </VTooltip>
      </IconBtn>

      <VMenu :disabled="!editor.isActive('table')" :close-on-content-click="false">
        <template #activator="{ props: menuProps }">
          <IconBtn size="small" variant="text" :disabled="!editor.isActive('table')" v-bind="menuProps">
            <VIcon icon="tabler-table-options" />
            <VTooltip activator="parent" location="top">
              Opciones de tabla
            </VTooltip>
          </IconBtn>
        </template>

        <VCard min-width="360">
          <VCardText>
            <div class="editor-menu-grid">
              <VBtn size="small" variant="tonal" prepend-icon="tabler-column-insert-left" @click="editor.chain().focus().addColumnBefore().run()">
                Columna antes
              </VBtn>
              <VBtn size="small" variant="tonal" prepend-icon="tabler-column-insert-right" @click="editor.chain().focus().addColumnAfter().run()">
                Columna despues
              </VBtn>
              <VBtn size="small" variant="tonal" color="error" prepend-icon="tabler-column-remove" @click="editor.chain().focus().deleteColumn().run()">
                Eliminar columna
              </VBtn>
              <VBtn size="small" variant="tonal" prepend-icon="tabler-row-insert-top" @click="editor.chain().focus().addRowBefore().run()">
                Fila arriba
              </VBtn>
              <VBtn size="small" variant="tonal" prepend-icon="tabler-row-insert-bottom" @click="editor.chain().focus().addRowAfter().run()">
                Fila abajo
              </VBtn>
              <VBtn size="small" variant="tonal" color="error" prepend-icon="tabler-row-remove" @click="editor.chain().focus().deleteRow().run()">
                Eliminar fila
              </VBtn>
              <VBtn size="small" variant="tonal" prepend-icon="tabler-table-alias" @click="editor.chain().focus().mergeCells().run()">
                Unir celdas
              </VBtn>
              <VBtn size="small" variant="tonal" prepend-icon="tabler-table-split" @click="editor.chain().focus().splitCell().run()">
                Separar celda
              </VBtn>
              <VBtn size="small" variant="tonal" prepend-icon="tabler-heading" @click="editor.chain().focus().toggleHeaderCell().run()">
                Celda cabecera
              </VBtn>
              <VBtn size="small" variant="tonal" prepend-icon="tabler-table-row" @click="editor.chain().focus().toggleHeaderRow().run()">
                Fila cabecera
              </VBtn>
              <VBtn size="small" variant="tonal" prepend-icon="tabler-table-column" @click="editor.chain().focus().toggleHeaderColumn().run()">
                Columna cabecera
              </VBtn>
              <VBtn size="small" variant="tonal" color="error" prepend-icon="tabler-table-off" @click="editor.chain().focus().deleteTable().run()">
                Eliminar tabla
              </VBtn>
            </div>

            <VDivider class="my-4" />

            <div class="text-caption text-medium-emphasis mb-2">
              Fondo de celda
            </div>
            <div class="d-flex flex-wrap gap-2 mb-4">
              <button
                v-for="color in backgroundSwatches"
                :key="`cell-bg-${color}`"
                type="button"
                class="editor-color-swatch"
                :style="{ backgroundColor: color }"
                @click="setCellAttribute('backgroundColor', color)"
              />
              <VBtn size="small" variant="tonal" color="secondary" @click="setCellAttribute('backgroundColor', null)">
                Quitar
              </VBtn>
            </div>

            <div class="text-caption text-medium-emphasis mb-2">
              Color de borde
            </div>
            <div class="d-flex flex-wrap gap-2">
              <button
                v-for="color in colorSwatches"
                :key="`cell-border-${color}`"
                type="button"
                class="editor-color-swatch"
                :style="{ backgroundColor: color }"
                @click="setCellAttribute('borderColor', color)"
              />
              <VBtn size="small" variant="tonal" color="secondary" @click="setCellAttribute('borderColor', null)">
                Quitar
              </VBtn>
            </div>
          </VCardText>
        </VCard>
      </VMenu>

      <VDivider vertical inset class="mx-1" />

      <IconBtn
        size="small"
        variant="text"
        :disabled="!editor.can().chain().focus().undo().run()"
        @click="editor.chain().focus().undo().run()"
      >
        <VIcon icon="tabler-arrow-back-up" />
      </IconBtn>

      <IconBtn
        size="small"
        variant="text"
        :disabled="!editor.can().chain().focus().redo().run()"
        @click="editor.chain().focus().redo().run()"
      >
        <VIcon icon="tabler-arrow-forward-up" />
      </IconBtn>
    </div>

    <VDivider />

    <EditorContent
      :editor="editor"
      class="editor-content"
    />
  </div>
</template>

<style lang="scss">
.editor-shell {
  border-color: rgba(var(--v-border-color), var(--v-border-opacity));
}

.editor-toolbar {
  background: rgba(var(--v-theme-surface-variant), 0.08);
}

.editor-menu-grid {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.editor-color-swatch {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 4px;
  block-size: 28px;
  cursor: pointer;
  inline-size: 28px;
}

.editor-color-swatch:hover {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.editor-content {
  min-block-size: 22rem;
}

.ProseMirror {
  padding: 1rem;
  min-block-size: 22rem;
  outline: none;

  h1,
  h2,
  h3 {
    margin-block: 0.8rem 0.4rem;
  }

  p,
  ul,
  ol,
  blockquote,
  pre {
    margin-block: 0.4rem 0;
  }

  ul,
  ol {
    padding-inline-start: 1.5rem;
  }

  blockquote {
    border-inline-start: 3px solid rgba(var(--v-theme-primary), 0.45);
    margin-inline: 0;
    padding-inline-start: 0.8rem;
  }

  pre {
    background: rgba(var(--v-theme-on-surface), 0.06);
    border-radius: 6px;
    padding: 0.75rem;
    white-space: pre-wrap;
  }

  img {
    block-size: auto;
    display: block;
    max-inline-size: 100%;
  }

  table {
    border-collapse: collapse;
    margin-block: 0.75rem;
    overflow: hidden;
    table-layout: fixed;
    inline-size: 100%;

    td,
    th {
      border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
      min-inline-size: 1em;
      padding: 0.45rem 0.6rem;
      position: relative;
      vertical-align: top;

      > * {
        margin-block: 0;
      }
    }

    th {
      background: rgba(var(--v-theme-primary), 0.10);
      font-weight: 600;
    }

    .selectedCell::after {
      background: rgba(var(--v-theme-primary), 0.14);
      content: "";
      inset: 0;
      pointer-events: none;
      position: absolute;
      z-index: 2;
    }

    .column-resize-handle {
      background-color: rgb(var(--v-theme-primary));
      block-size: 100%;
      inline-size: 4px;
      inset-block-start: 0;
      inset-inline-end: -2px;
      pointer-events: none;
      position: absolute;
    }
  }

  &.resize-cursor {
    cursor: ew-resize;
    cursor: col-resize;
  }

  p.is-editor-empty:first-child::before {
    block-size: 0;
    color: rgba(var(--v-theme-on-surface), 0.45);
    content: attr(data-placeholder);
    float: inline-start;
    pointer-events: none;
  }
}
</style>
