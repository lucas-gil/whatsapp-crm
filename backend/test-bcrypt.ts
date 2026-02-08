import * as bcrypt from 'bcrypt';

async function testBcrypt() {
  const adminKey = 'admin123456789admin123456789admin1';
  
  console.log('\n🔐 TESTE DE BCRYPT\n');
  console.log(`Chave original: ${adminKey}`);
  console.log(`Tamanho: ${adminKey.length} caracteres`);
  
  try {
    // 1. Gerar hash como no seed
    console.log('\n1️⃣ Gerando hash com bcrypt...');
    const hash = await bcrypt.hash(adminKey, 12);
    console.log(`Hash gerado: ${hash}`);
    
    // 2. Testar comparação correta
    console.log('\n2️⃣ Testando comparação (deve passar)...');
    const match1 = await bcrypt.compare(adminKey, hash);
    console.log(`bcrypt.compare("${adminKey}", hash) = ${match1 ? '✅ TRUE' : '❌ FALSE'}`);
    
    // 3. Testar com espaços
    console.log('\n3️⃣ Testando com espaços extras (deve falhar)...');
    const keyWithSpaces = ` ${adminKey} `;
    const match2 = await bcrypt.compare(keyWithSpaces, hash);
    console.log(`bcrypt.compare(" ${adminKey} ", hash) = ${match2 ? '✅ TRUE' : '❌ FALSE'}`);
    
    // 4. Testar com trim
    console.log('\n4️⃣ Testando com trim (deve passar)...');
    const keyTrimmed = keyWithSpaces.trim();
    const match3 = await bcrypt.compare(keyTrimmed, hash);
    console.log(`bcrypt.compare("${adminKey}".trim(), hash) = ${match3 ? '✅ TRUE' : '❌ FALSE'}`);
    
    // 5. Testar com chave errada
    console.log('\n5️⃣ Testando com chave errada (deve falhar)...');
    const wrongKey = 'admin123456789admin123456789admin2';
    const match4 = await bcrypt.compare(wrongKey, hash);
    console.log(`bcrypt.compare("${wrongKey}", hash) = ${match4 ? '✅ TRUE' : '❌ FALSE'}`);
    
    // 6. Gerar múltiplos hashes e testar
    console.log('\n6️⃣ Testando múltiplos hashes...');
    for (let i = 0; i < 3; i++) {
      const newHash = await bcrypt.hash(adminKey, 12);
      const matches = await bcrypt.compare(adminKey, newHash);
      console.log(`Hash ${i+1}: ${matches ? '✅' : '❌'} ${newHash.substring(0, 30)}...`);
    }
    
    console.log('\n✨ Teste concluído!\n');
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

testBcrypt();
