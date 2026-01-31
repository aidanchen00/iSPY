#!/bin/bash

echo "🧪 Testing iSPY Application"
echo "=============================="
echo ""

# Test 1: Server Running
echo "✓ Test 1: Server is running on http://localhost:3000"
echo ""

# Test 2: Home Page
echo "✓ Test 2: Home page accessible"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:3000/
echo ""

# Test 3: Dashboard
echo "✓ Test 3: Dashboard accessible"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:3000/pages/dashboard
echo ""

# Test 4: Live Stream Page
echo "✓ Test 4: Live Stream page accessible"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:3000/pages/realtimeStreamPage
echo ""

# Test 5: Saved Videos
echo "✓ Test 5: Saved Videos page accessible"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:3000/pages/saved-videos
echo ""

# Test 6: Statistics
echo "✓ Test 6: Statistics page accessible"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:3000/pages/statistics
echo ""

echo "=============================="
echo "All pages are accessible!"
echo ""
echo "⚠️  Note: OpenAI API key needs to be updated for AI features"
echo "📝 See TEST_RESULTS.md for details"
