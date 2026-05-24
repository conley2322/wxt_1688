<script setup>
import { ref } from 'vue';
const props = defineProps({
  msg: {
    description: 'hello world',
    default: 'hello world',
    type: String,
  },

});
const count = ref(0);


</script>

<template>
  hello world
  <h1>
    {{ props.msg }}</h1>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
