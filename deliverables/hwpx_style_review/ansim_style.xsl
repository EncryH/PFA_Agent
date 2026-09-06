<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"
  xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core">

  <xsl:output method="xml" encoding="UTF-8" standalone="yes"/>

  <xsl:template match="@*|node()">
    <xsl:copy>
      <xsl:apply-templates select="@*|node()"/>
    </xsl:copy>
  </xsl:template>

  <!-- Team information cells: calm blue-gray background. -->
  <xsl:template match="hh:borderFill[@id='3']/hc:fillBrush/hc:winBrush/@faceColor">
    <xsl:attribute name="faceColor">#E7EEFB</xsl:attribute>
  </xsl:template>

  <!-- Required section headers: light blue background. -->
  <xsl:template match="hh:borderFill[@id='8']/hc:fillBrush/hc:winBrush/@faceColor">
    <xsl:attribute name="faceColor">#EEF4FF</xsl:attribute>
  </xsl:template>

  <!-- Soften the official table grid without changing the table structure. -->
  <xsl:template match="hh:borderFill[@id='3' or @id='6' or @id='8' or @id='9']/*[self::hh:leftBorder or self::hh:rightBorder or self::hh:topBorder or self::hh:bottomBorder]/@color">
    <xsl:attribute name="color">#C8D4E8</xsl:attribute>
  </xsl:template>

  <!-- Ansim Companion AI color system. -->
  <xsl:template match="hh:charPr[@id='0']/@textColor">
    <xsl:attribute name="textColor">#2563EB</xsl:attribute>
  </xsl:template>

  <xsl:template match="hh:charPr[@id='2']/@textColor">
    <xsl:attribute name="textColor">#163A70</xsl:attribute>
  </xsl:template>

  <xsl:template match="hh:charPr[@id='15']/@textColor">
    <xsl:attribute name="textColor">#163A70</xsl:attribute>
  </xsl:template>

  <xsl:template match="hh:charPr[@id='17']/@textColor">
    <xsl:attribute name="textColor">#46566F</xsl:attribute>
  </xsl:template>

  <xsl:template match="hh:charPr[@id='18']/@textColor">
    <xsl:attribute name="textColor">#2563EB</xsl:attribute>
  </xsl:template>
</xsl:stylesheet>
