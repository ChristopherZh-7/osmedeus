package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"
)

func TestExportedHTMLRouteSupportsDirectRefresh(t *testing.T) {
	app := fiber.New()
	registerExportedHTMLRoutes(app, fstest.MapFS{
		"agent-pentest.html": {Data: []byte("<title>智能渗透</title>")},
	})

	response, err := app.Test(httptest.NewRequest(http.MethodGet, "/agent-pentest", nil))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, response.StatusCode)
	require.Equal(t, "text/html; charset=utf-8", response.Header.Get("Content-Type"))
	body, err := io.ReadAll(response.Body)
	require.NoError(t, err)
	require.Contains(t, string(body), "智能渗透")
}

func TestExportedHTMLRouteIgnoresUnknownPaths(t *testing.T) {
	app := fiber.New()
	registerExportedHTMLRoutes(app, fstest.MapFS{})

	response, err := app.Test(httptest.NewRequest(http.MethodGet, "/not-a-page", nil))
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, response.StatusCode)
}
