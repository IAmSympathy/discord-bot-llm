# Script de test de connexion - À exécuter sur Oracle Cloud
# Test la connectivité vers vos services locaux

echo "🔍 Test de connexion vers les services locaux..."
echo ""

# Remplacez par votre IP/domaine
LOCAL_IP="VOTRE_IP_PUBLIQUE"

echo "📡 Test Ollama (port 11434)..."
if curl -s "http://$LOCAL_IP:11434/api/tags" > /dev/null 2>&1; then
    echo "✅ Ollama accessible !"
    curl -s "http://$LOCAL_IP:11434/api/tags" | head -n 10
else
    echo "❌ Ollama non accessible"
    echo "   Vérifiez :"
    echo "   - Port forwarding sur votre routeur"
    echo "   - Pare-feu Windows"
    echo "   - Ollama tourne avec ollama serve"
fi

echo ""
echo "🎨 Test Python API (port 8000)..."
if curl -s "http://$LOCAL_IP:8000/" > /dev/null 2>&1; then
    echo "✅ Python API accessible !"
    curl -s "http://$LOCAL_IP:8000/" | head -n 10
else
    echo "❌ Python API non accessible"
    echo "   Vérifiez :"
    echo "   - Port forwarding sur votre routeur"
    echo "   - Pare-feu Windows"
    echo "   - API démarrée avec --host 0.0.0.0"
fi

echo ""
echo "✅ Test terminé !"

